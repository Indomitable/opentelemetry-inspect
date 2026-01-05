<script setup lang="ts">
import { useRoute } from 'vue-router';
import { computed } from 'vue';
import type {TreeTableExpandedKeys} from 'primevue/treetable';
import type { TreeNode } from 'primevue/treenode';
import { useTracesStore } from '../state/traces-store';
import { durationToString, Span } from '../domain/traces';
import SpanDurationBar from '../components/span-duration-bar.vue';
import {useLogsStore} from "../state/logs-store.ts";
import {Log} from "../domain/logs.ts";

const route = useRoute();
const tracesStore = useTracesStore();
const logsStore = useLogsStore();
const traceId = route.params.traceId as string;

const spansForTrace = computed(() => {
  return Object.values(tracesStore.index).filter(s => s.trace_id === traceId);
});

const rootSpan = computed(() => spansForTrace.value.find(s => !s.parent_span_id) || null);

function spanToNode(spanOrLog: Span|Log): TreeNode {
  if ('children' in spanOrLog) {
    const logChildren = logsStore.logs.filter(l => l.trace_id === spanOrLog.trace_id && l.span_id && l.span_id === spanOrLog.span_id);
    const children: (Span|Log)[] = [...spanOrLog.children, ...logChildren].sort((a, b) => {
      const aStart = 'start_ns' in a ? a.start_ns : a.time_ns;
      const bStart = 'start_ns' in b ? b.start_ns : b.time_ns;
      return aStart < bStart ? -1 : aStart > bStart ? 1 : 0;
    });
    return {
      key: `${spanOrLog.trace_id}-${spanOrLog.span_id}`,
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
      key: `${spanOrLog.trace_id}-${spanOrLog.span_id}-${spanOrLog.timestamp}`,
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

</script>

<template>
  <div class="page">
    <div class="page__container">
      <div class="page__header-row">
        <h1>Trace: {{ route.params.traceId }}</h1>
      </div>
      <TreeTable
          :value="treeNodes"
          dataKey="key"
          :scrollable="true"
          scrollHeight="flex"
          sort-field="start_ns"
          :sort-order=1
          size="small"
          :expanded-keys="expandedKeys"
          class="p-datatable-sm list-table">
        <template #empty><div class="list-table__empty">No spans for this trace.</div></template>
        <Column field="name" header="Name" expander :style="{ width: '200px' }" />
        <Column header="Duration" :style="{ width: '120px' }">
          <template #body="slotProps">
            <span v-if="slotProps.node.data.type === 'span'">
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
  </div>
</template>

