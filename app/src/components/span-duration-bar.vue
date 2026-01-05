<script setup lang="ts">
import type { Span } from '../domain/traces';
import { durationToString } from '../domain/traces';
import {TraceDetailsViewModels} from "../viewmodels/trace-details-models.ts";
import {getSeverityType} from "../domain/logs-exensions.ts";

interface Props {
  span: TraceDetailsViewModels.SpanOrLogModel;
  parentSpan?: Span;
  traceStartTime?: bigint;
  traceEndTime?: bigint;
}

const props = withDefaults(defineProps<Props>(), {
  parentSpan: undefined,
  traceStartTime: undefined,
  traceEndTime: undefined
});

// Calculate relative position and width as percentages
const spanStart = props.span.start_ns;
const spanEnd = props.span.end_ns;
const spanDuration = props.span.duration;

// Use parent times if provided (show span relative to parent)
// Otherwise use trace times, or span times as fallback
let referenceStart: bigint;
let referenceDuration: bigint;

if (props.parentSpan) {
  referenceStart = props.parentSpan.start_ns;
  referenceDuration = props.parentSpan.duration;
} else {
  const traceStart = props.traceStartTime ?? spanStart;
  const traceEnd = props.traceEndTime ?? spanEnd;
  referenceStart = traceStart;
  referenceDuration = traceEnd - traceStart;
}

const safeReferenceDuration = referenceDuration > 0n ? referenceDuration : 1n;

const offsetPercent = referenceDuration > 0n
  ? Number((spanStart - referenceStart) * 100n / safeReferenceDuration)
  : 0;

const widthPercent = referenceDuration > 0n
  ? Number(spanDuration * 100n / safeReferenceDuration)
  : 0;

const leftOffset = Math.max(0, Math.min(100, offsetPercent));
const barWidth = Math.max(0.5, Math.min(100 - leftOffset, widthPercent));

const getSpanDurationClass = (duration: bigint) => {
  if (duration < 1000000n) return 'duration-fast'; // less than 1ms
  if (duration < 10000000n) return 'duration-medium'; // between 1ms and 10ms
  if (duration < 100000000n) return 'duration-slow'; // between 10ms and 100ms
  return 'duration-x-slow'; // greater than 100ms
};
</script>

<template>
  <div class="span-duration-bar-container">
    <div class="span-duration-bar-track">
      <div
        v-if="span.type === 'span'"
        :class="['span-duration-bar-fill', getSpanDurationClass(span.duration)]"
        :style="{
          left: `${leftOffset}%`,
          width: `${barWidth}%`,
        }"
        :title="`${span.name} - ${durationToString(span.duration)}`"
      />
      <div
          v-if="span.type === 'log'"
          :class="['log-duration-bar-fill', getSeverityType(span.severity!)]"
          :style="{
            left: `${leftOffset}%`,
            width: `5px`,
          }"
          :title="`${span.severity}: ${span.name}`"
      />
    </div>
    <div class="span-duration-bar-label">
      <span class="duration-text" v-if="span.type === 'span'">{{ durationToString(spanDuration) }}</span>
    </div>
  </div>
</template>

<style scoped>
.span-duration-bar-container {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  width: 100%;
}

.span-duration-bar-track {
  flex: 1;
  height: 20px;
  background-color: #f0f0f0;
  border-radius: 3px;
  border: 1px solid #e0e0e0;
  position: relative;
  overflow: hidden;
  width: 100%;
}

.span-duration-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.2s ease;
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.1);
  cursor: pointer;
  position: absolute;
}

.duration-fast { background-color: var(--span-duration-fast);}
.duration-medium { background-color: var(--span-duration-medium);}
.duration-slow { background-color: var(--span-duration-slow);}
.duration-x-slow { background-color: var(--span-duration-x-slow);}

.log-duration-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.2s ease;
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.1);
  cursor: pointer;
  position: absolute;
}

.log-duration-bar-fill.debug { background-color: var(--logs-severity-debug); }
.log-duration-bar-fill.info { background-color: var(--logs-severity-info); }
.log-duration-bar-fill.warn { background-color: var(--logs-severity-warning); }
.log-duration-bar-fill.error { background-color: var(--logs-severity-error); }
.log-duration-bar-fill.critical { background-color: var(--logs-severity-critical); }

.span-duration-bar-fill:hover {
  opacity: 0.8;
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.2), 0 0 8px rgba(0, 0, 0, 0.1);
}

.span-duration-bar-label {
  min-width: 100px;
  text-align: right;
  font-size: 12px;
  color: #666;
  font-family: 'Courier New', monospace;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .span-duration-bar-track {
    background-color: #2a2a2a;
    border-color: #444;
  }

  .span-duration-bar-label {
    color: #aaa;
  }
}
</style>

