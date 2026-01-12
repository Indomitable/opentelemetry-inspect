<script setup lang="ts">
import { useRoute } from 'vue-router';
import {computed, ComputedRef, ref, watch} from 'vue';
import type { TreeTableExpandedKeys, TreeTableSelectionKeys } from 'primevue/treetable';
import type { TreeNode } from 'primevue/treenode';
import { useTracesStore } from '../state/traces-store';
import { durationToString, Span } from '../domain/traces';
import SpanDurationBar from '../components/span-duration-bar.vue';
import {useLogsStore} from "../state/logs-store.ts";
import {Log} from "../domain/logs.ts";
import SpanDetailsView from "../components/span-details-view.vue";
import LogsDetailsView from "../components/logs-details-view.vue";
import {sortBigIntAsc} from "../helpers/bigint-helpers.ts";

const route = useRoute();
const tracesStore = useTracesStore();
const logsStore = useLogsStore();
const traceId = route.params.traceId as string;
const selectedKey = ref<TreeTableSelectionKeys | undefined>(undefined);
const showLogs = ref<boolean>(false); // Default: logs hidden

const spansForTrace = computed(() => {
  return Object.values(tracesStore.index).filter(s => s.trace_id === traceId).sort((a, b) => sortBigIntAsc(a.start_ns, b.start_ns));
});
const logsForTrace = computed(() => {
  if (!showLogs.value) return [];
  return logsStore.logs.filter(l => l.trace_id === traceId).sort((a, b) => sortBigIntAsc(a.time_ns, b.time_ns));
});

// Find all root spans: spans without parent_span_id OR orphaned spans (parent exists but is not reported)
const rootSpans = computed(() => {
  return spansForTrace.value.filter(span => {
    // True root: no parent_span_id
    if (!span.parent_span_id) {
      return true;
    }
    // Orphaned span: has parent_span_id but parent is missing from index
    const parentKey = `${span.trace_id}-${span.parent_span_id}`;
    return !tracesStore.index[parentKey];
  }).sort((a, b) => sortBigIntAsc(a.start_ns, b.start_ns));
});

// Calculate trace-wide min start and max end times across all spans and (optionally) logs
const traceTimeRange = computed(() => {
  let minStart = spansForTrace.value[spansForTrace.value.length - 1].end_ns;
  let maxEnd = 0n;

  // Check all spans
  for (const span of spansForTrace.value) {
    if (span.start_ns < minStart) {
      minStart = span.start_ns;
    }
    if (span.end_ns > maxEnd) {
      maxEnd = span.end_ns;
    }
  }

  // Check all logs
  for (const log of logsForTrace.value) {
    if (log.time_ns < minStart) {
      minStart = log.time_ns;
    }
    const logEnd = log.time_ns + 1n;
    if (logEnd > maxEnd) {
      maxEnd = logEnd;
    }
  }

  return { start: minStart, end: maxEnd };
});

function spanToNode(spanOrLog: Span|Log): TreeNode {
  if ('children' in spanOrLog) {
    const logChildren = logsForTrace.value.filter(l => l.span_id === spanOrLog.span_id);
    const children: (Span|Log)[] = [...spanOrLog.children, ...logChildren].sort((a, b) => {
      const aStart = 'start_ns' in a ? a.start_ns : a.time_ns;
      const bStart = 'start_ns' in b ? b.start_ns : b.time_ns;
      return aStart < bStart ? -1 : aStart > bStart ? 1 : 0;
    });
    return {
      key: `span|${spanOrLog.trace_id}|${spanOrLog.span_id}`,
      data: {
        trace_id: spanOrLog.trace_id,
        parent_span_id: spanOrLog.parent_span_id,
        span_id: spanOrLog.span_id,
        name: spanOrLog.name,
        duration: spanOrLog.duration,
        start_ns: spanOrLog.start_ns,
        end_ns: spanOrLog.end_ns,
        type: 'span',
      },
      children: children.map(spanToNode),
    } as TreeNode;
  } else {
    return {
      key: `log|${spanOrLog.trace_id}|${spanOrLog.span_id}|${spanOrLog.timestamp}`,
      data: {
        trace_id: spanOrLog.trace_id!,
        parent_span_id: spanOrLog.span_id!,
        timestamp: spanOrLog.timestamp,
        time_ns: spanOrLog.time_ns,
        start_ns: spanOrLog.time_ns,
        end_ns: spanOrLog.time_ns + 1n,
        duration: 1n,
        name: spanOrLog.message,
        severity: spanOrLog.severity,
        type: 'log'
      },
      children: [],
    } as TreeNode;
  }
}

const treeNodes = computed(() => {
  if (rootSpans.value.length === 0) return [];
  return rootSpans.value.map(span => spanToNode(span));
});

// Helper function to collect all keys from a tree node recursively
function collectNodeKeys(node: TreeNode, acc: Record<string, boolean>) {
  acc[node.key as string] = true;
  if (node.children) {
    for (const child of node.children) {
      collectNodeKeys(child, acc);
    }
  }
}

// Expand all nodes by default (reactive)
const expandedKeys = computed<TreeTableExpandedKeys>(() => {
  const keys: Record<string, boolean> = {};
  for (const rootNode of treeNodes.value) {
    collectNodeKeys(rootNode, keys);
  }
  return keys;
});

type SelectedItem = (Span & { type: 'span' }) | (Log & { type: 'log' }) | undefined;
const selectedItem: ComputedRef<SelectedItem> = computed(() => {
   if (selectedKey.value) {
     const keys = Object.keys(selectedKey.value);
      if (keys.length > 0) {
        const key = keys[0];
        if (key.startsWith('span')) {
          const [, traceId, spanId] = key.split('|');
          const span = tracesStore.index[`${traceId}-${spanId}`];
          if (span) {
            return { ...span, type: 'span' };
          }
        } else if (key.startsWith('log')) {
          const timestamp = key.split('|')[3];
          const log = logsForTrace.value.find(l => l.timestamp === timestamp);
          if (log) {
            return { ...log, type: 'log' };
          }
        }
      }
   }
});
const closeDetails = () => {
  selectedKey.value = undefined;
};

// Clear log selection when logs are hidden
watch(showLogs, (newValue) => {
  if (!newValue && selectedKey.value) {
    const keys = Object.keys(selectedKey.value);
    if (keys.length > 0 && keys[0].startsWith('log')) {
      selectedKey.value = undefined;
    }
  }
});

</script>

<template>
  <div class="page">
    <div class="page__container" :class="{ 'page__container--with-details': selectedItem }">
      <div class="page__header-row">
        <h1>Trace: {{ route.params.traceId }} (Duration: {{ durationToString(traceTimeRange.end - traceTimeRange.start) }})</h1>
        <div class="page__header-controls">
          <label for="show-logs-toggle" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <ToggleSwitch id="show-logs-toggle" v-model="showLogs" />
            <span>Show Logs</span>
          </label>
        </div>
      </div>
      <TreeTable
          :value="treeNodes"
          selection-mode="single"
          v-model:selection-keys="selectedKey"
          data-key="key"
          :scrollable="true"
          scroll-height="flex"
          size="small"
          :expanded-keys="expandedKeys"
          class="p-datatable-sm list-table">
        <template #empty><div class="list-table__empty">No spans for this trace.</div></template>
        <Column field="name" header="Name" expander :style="{ width: '300px' }" />
        <Column header="Duration" :style="{ width: '150px' }">
          <template #body="slotProps">
            <span v-if="slotProps.node.data.type === 'span'" :style="{ whiteSpace: 'nowrap' }">
              {{ durationToString(slotProps.node.data.duration) }}
            </span>
          </template>
        </Column>
        <Column header="Timeline" :style="{ width: '400px' }">
          <template #body="slotProps">
            <SpanDurationBar
              :span="slotProps.node.data"
              :trace-start-time="traceTimeRange.start"
              :trace-end-time="traceTimeRange.end"
            />
          </template>
        </Column>
      </TreeTable>
    </div>
    <Transition name="slide">
        <span-details-view :span="selectedItem" v-if="selectedItem && selectedItem.type === 'span'" @close="closeDetails" />
    </Transition>
    <Transition name="slide">
        <logs-details-view :log="selectedItem" v-if="selectedItem && selectedItem.type === 'log'" @close="closeDetails" />
    </Transition>
  </div>
</template>

