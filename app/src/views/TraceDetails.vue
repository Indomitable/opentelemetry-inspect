<script setup lang="ts">
import { useRoute } from 'vue-router';
import {computed, ComputedRef, ref} from 'vue';
import type { TreeTableExpandedKeys, TreeTableSelectionKeys } from 'primevue/treetable';
import type { TreeNode } from 'primevue/treenode';
import { useTracesStore } from '../state/traces-store';
import { durationToString, Span } from '../domain/traces';
import SpanDurationBar from '../components/span-duration-bar.vue';
import {useLogsStore} from "../state/logs-store.ts";
import {Log} from "../domain/logs.ts";
import SpanDetailsView from "../components/span-details-view.vue";
import LogsDetailsView from "../components/logs-details-view.vue";

const route = useRoute();
const tracesStore = useTracesStore();
const logsStore = useLogsStore();
const traceId = route.params.traceId as string;
const selectedKey = ref<TreeTableSelectionKeys | undefined>(undefined);

const spansForTrace = computed(() => {
  return Object.values(tracesStore.index).filter(s => s.trace_id === traceId);
});
const logsForTrace = computed(() => {
  return logsStore.logs.filter(l => l.trace_id === traceId);
});

const rootSpan = computed(() => spansForTrace.value.find(s => !s.parent_span_id) || null);

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

function getParentSpan(span: Span): Span | undefined {
  if (!span.parent_span_id) return undefined;
  const parentKey = `${span.trace_id}-${span.parent_span_id}`;
  return tracesStore.index[parentKey];
}

const treeNodes = computed(() => {
  if (!rootSpan.value) return [];
  return [spanToNode(rootSpan.value)];
});

// Expand all nodes by default
const expandedKeys: TreeTableExpandedKeys = spansForTrace.value.map(spanToNode).reduce((acc, node) => {
  acc[node.key as string] = true;
  return acc;
}, {} as TreeTableExpandedKeys);

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

</script>

<template>
  <div class="page">
    <div class="page__container" :class="{ 'page__container--with-details': selectedItem }">
      <div class="page__header-row">
        <h1>Trace: {{ route.params.traceId }}</h1>
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
              :parent-span="getParentSpan(slotProps.node.data)"
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

