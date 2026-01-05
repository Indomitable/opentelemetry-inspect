import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SpanDurationBar from '../span-duration-bar.vue';
import type { Span } from '../../domain/traces';

// Helper function to create a mock span
function createMockSpan(overrides: Partial<Span> = {}): Span {
  return {
    start_time: '2024-01-01T00:00:00.000000000Z',
    end_time: '2024-01-01T00:00:01.000000000Z',
    scope: 'test.scope',
    name: 'test-span',
    trace_id: 'trace-1',
    span_id: 'span-1',
    resource: {
      service_name: 'test-service',
      service_version: '1.0.0',
      service_namespace: 'test',
      service_instance_id: 'instance-1',
      attributes: {}
    },
    kind: 'INTERNAL',
    status: {
      message: 'ok',
      code: 'OK'
    },
    tags: {},
    events: [],
    links: [],
    children: [],
    start_ns: 1000000000n,
    end_ns: 2000000000n,
    duration: 1000000000n,
    ...overrides
  };
}

describe('SpanDurationBar Component', () => {
  describe('Bar Positioning and Width Calculations', () => {
    it('should render a bar at 100% width for root span (no parent)', () => {
      const span = createMockSpan({
        start_ns: 1000000000n,
        end_ns: 2000000000n,
        duration: 1000000000n
      });

      const wrapper = mount(SpanDurationBar, {
        props: {
          span,
          traceStartTime: 1000000000n,
          traceEndTime: 2000000000n
        }
      });

      const bar = wrapper.find('.span-duration-bar-fill');
      const styles = bar.attributes('style');

      // Should be positioned at 0% and width 100%
      expect(styles).toContain('left: 0%');
      expect(styles).toContain('width: 100%');
    });

    it('should position child span at 10% with 20% width (child starts 10ms after parent, duration 20ms, parent 100ms)', () => {
      // Parent: 100ms duration
      // Child: 20ms duration, starts 10ms after parent
      // Expected: left 10%, width 20%

      const parentStart = 1000000000n; // 1s in nanoseconds
      const parentDuration = 100000000n; // 100ms

      const parent = createMockSpan({
        start_ns: parentStart,
        duration: parentDuration,
        end_ns: parentStart + parentDuration,
        name: 'parent-span'
      });

      const childStart = parentStart + 10000000n; // starts 10ms after parent
      const childDuration = 20000000n; // 20ms

      const child = createMockSpan({
        start_ns: childStart,
        duration: childDuration,
        end_ns: childStart + childDuration,
        name: 'child-span',
        span_id: 'span-2'
      });

      const wrapper = mount(SpanDurationBar, {
        props: {
          span: child,
          parentSpan: parent
        }
      });

      const bar = wrapper.find('.span-duration-bar-fill');
      const styles = bar.attributes('style');

      expect(styles).toContain('left: 10%');
      expect(styles).toContain('width: 20%');
    });

    it('should handle child span at the very start of parent (0% offset, 50% width)', () => {
      // Child starts at same time as parent, has half parent's duration
      const parentStart = 1000000000n;
      const parentDuration = 100000000n; // 100ms

      const parent = createMockSpan({
        start_ns: parentStart,
        duration: parentDuration,
        end_ns: parentStart + parentDuration,
        name: 'parent-span'
      });

      const child = createMockSpan({
        start_ns: parentStart, // same as parent
        duration: parentDuration / 2n, // 50ms
        end_ns: parentStart + (parentDuration / 2n),
        name: 'child-span',
        span_id: 'span-2'
      });

      const wrapper = mount(SpanDurationBar, {
        props: {
          span: child,
          parentSpan: parent
        }
      });

      const bar = wrapper.find('.span-duration-bar-fill');
      const styles = bar.attributes('style');

      expect(styles).toContain('left: 0%');
      expect(styles).toContain('width: 50%');
    });

    it('should handle child span at the end of parent (90% offset, 10% width)', () => {
      // Child starts 90ms into parent (90% offset), has 10% duration
      const parentStart = 1000000000n;
      const parentDuration = 100000000n; // 100ms

      const parent = createMockSpan({
        start_ns: parentStart,
        duration: parentDuration,
        end_ns: parentStart + parentDuration,
        name: 'parent-span'
      });

      const childStart = parentStart + 90000000n; // 90ms after parent start
      const childDuration = 10000000n; // 10ms

      const child = createMockSpan({
        start_ns: childStart,
        duration: childDuration,
        end_ns: childStart + childDuration,
        name: 'child-span',
        span_id: 'span-2'
      });

      const wrapper = mount(SpanDurationBar, {
        props: {
          span: child,
          parentSpan: parent
        }
      });

      const bar = wrapper.find('.span-duration-bar-fill');
      const styles = bar.attributes('style');

      expect(styles).toContain('left: 90%');
      expect(styles).toContain('width: 10%');
    });

    it('should handle very small child span (prevents width below 0.5%)', () => {
      // Child span is extremely short (much smaller than parent)
      const parentStart = 1000000000n;
      const parentDuration = 100000000000n; // 100s (very large)

      const parent = createMockSpan({
        start_ns: parentStart,
        duration: parentDuration,
        end_ns: parentStart + parentDuration,
        name: 'parent-span'
      });

      const childStart = parentStart + 1000000n; // 1ms after parent start
      const childDuration = 1n; // 1 nanosecond (extremely small)

      const child = createMockSpan({
        start_ns: childStart,
        duration: childDuration,
        end_ns: childStart + childDuration,
        name: 'tiny-child-span',
        span_id: 'span-2'
      });

      const wrapper = mount(SpanDurationBar, {
        props: {
          span: child,
          parentSpan: parent
        }
      });

      const bar = wrapper.find('.span-duration-bar-fill');
      const styles = bar.attributes('style');

      // Width should be clamped to minimum 0.5%
      expect(styles).toContain('width: 0.5%');
    });

    it('should clamp left offset to 0% when child starts before parent (edge case)', () => {
      // This shouldn't happen in real data, but verify graceful handling
      const parentStart = 1000000000n;
      const parentDuration = 100000000n;

      const parent = createMockSpan({
        start_ns: parentStart,
        duration: parentDuration,
        end_ns: parentStart + parentDuration,
        name: 'parent-span'
      });

      const child = createMockSpan({
        start_ns: parentStart - 1000000n, // starts BEFORE parent (shouldn't happen)
        duration: 10000000n,
        end_ns: parentStart + 9000000n,
        name: 'child-span',
        span_id: 'span-2'
      });

      const wrapper = mount(SpanDurationBar, {
        props: {
          span: child,
          parentSpan: parent
        }
      });

      const bar = wrapper.find('.span-duration-bar-fill');
      const styles = bar.attributes('style');

      // Should clamp to 0%
      expect(styles).toContain('left: 0%');
    });

    it('should clamp width to not exceed 100% when child extends past parent', () => {
      // Another edge case: child extends past parent
      const parentStart = 1000000000n;
      const parentDuration = 100000000n;

      const parent = createMockSpan({
        start_ns: parentStart,
        duration: parentDuration,
        end_ns: parentStart + parentDuration,
        name: 'parent-span'
      });

      const child = createMockSpan({
        start_ns: parentStart + 80000000n, // starts 80% in
        duration: 50000000n, // extends 50% duration (would go to 130% end)
        end_ns: parentStart + 130000000n,
        name: 'child-span',
        span_id: 'span-2'
      });

      const wrapper = mount(SpanDurationBar, {
        props: {
          span: child,
          parentSpan: parent
        }
      });

      const bar = wrapper.find('.span-duration-bar-fill');
      const styles = bar.attributes('style');

      expect(styles).toContain('left: 80%');
      // Width should be clamped to not exceed 100% - 80% = 20%
      expect(styles).toContain('width: 20%');
    });
  });

  describe('Color Assignment Based on Duration', () => {
    it('should use green color for spans < 1ms', () => {
      const span = createMockSpan({
        duration: 500000n // 0.5ms
      });

      const wrapper = mount(SpanDurationBar, {
        props: { span }
      });

      const bar = wrapper.find('.span-duration-bar-fill');
      const styles = bar.attributes('style');

      expect(styles).toContain('background-color: #4ade80');
    });

    it('should use blue color for spans between 1ms and 10ms', () => {
      const span = createMockSpan({
        duration: 5000000n // 5ms
      });

      const wrapper = mount(SpanDurationBar, {
        props: { span }
      });

      const bar = wrapper.find('.span-duration-bar-fill');
      const styles = bar.attributes('style');

      expect(styles).toContain('background-color: #60a5fa');
    });

    it('should use amber color for spans between 10ms and 100ms', () => {
      const span = createMockSpan({
        duration: 50000000n // 50ms
      });

      const wrapper = mount(SpanDurationBar, {
        props: { span }
      });

      const bar = wrapper.find('.span-duration-bar-fill');
      const styles = bar.attributes('style');

      expect(styles).toContain('background-color: #fbbf24');
    });

    it('should use red color for spans >= 100ms', () => {
      const span = createMockSpan({
        duration: 200000000n // 200ms
      });

      const wrapper = mount(SpanDurationBar, {
        props: { span }
      });

      const bar = wrapper.find('.span-duration-bar-fill');
      const styles = bar.attributes('style');

      expect(styles).toContain('background-color: #ef4444');
    });
  });

  describe('Multiple Child Spans in Sequence', () => {
    it('should position multiple child spans correctly', () => {
      const parentStart = 1000000000n;
      const parentDuration = 100000000n; // 100ms

      const parent = createMockSpan({
        start_ns: parentStart,
        duration: parentDuration,
        end_ns: parentStart + parentDuration,
        name: 'parent-span'
      });

      // Child 1: 10-30ms (left: 10%, width: 20%)
      const child1 = createMockSpan({
        start_ns: parentStart + 10000000n,
        duration: 20000000n,
        end_ns: parentStart + 30000000n,
        name: 'child-1',
        span_id: 'span-2'
      });

      // Child 2: 40-60ms (left: 40%, width: 20%)
      const child2 = createMockSpan({
        start_ns: parentStart + 40000000n,
        duration: 20000000n,
        end_ns: parentStart + 60000000n,
        name: 'child-2',
        span_id: 'span-3'
      });

      const wrapper1 = mount(SpanDurationBar, {
        props: {
          span: child1,
          parentSpan: parent
        }
      });

      const wrapper2 = mount(SpanDurationBar, {
        props: {
          span: child2,
          parentSpan: parent
        }
      });

      const bar1 = wrapper1.find('.span-duration-bar-fill');
      const bar2 = wrapper2.find('.span-duration-bar-fill');

      expect(bar1.attributes('style')).toContain('left: 10%');
      expect(bar1.attributes('style')).toContain('width: 20%');

      expect(bar2.attributes('style')).toContain('left: 40%');
      expect(bar2.attributes('style')).toContain('width: 20%');
    });
  });

  describe('Label Display', () => {
    it('should display the correct duration in the label', () => {
      const span = createMockSpan({
        duration: 50000000n // 50ms
      });

      const wrapper = mount(SpanDurationBar, {
        props: { span }
      });

      const label = wrapper.find('.duration-text');
      expect(label.text()).toContain('50ms');
    });

    it('should display duration in nanoseconds for very small spans', () => {
      const span = createMockSpan({
        duration: 500n // 500ns
      });

      const wrapper = mount(SpanDurationBar, {
        props: { span }
      });

      const label = wrapper.find('.duration-text');
      expect(label.text()).toContain('ns');
    });
  });

  describe('Tooltip', () => {
    it('should set tooltip with span name and duration', () => {
      const span = createMockSpan({
        name: 'my-operation',
        duration: 50000000n // 50ms
      });

      const wrapper = mount(SpanDurationBar, {
        props: { span }
      });

      const bar = wrapper.find('.span-duration-bar-fill');
      const title = bar.attributes('title');

      expect(title).toContain('my-operation');
      expect(title).toContain('50ms');
    });
  });

  describe('Fallback to Trace Times', () => {
    it('should use traceStartTime and traceEndTime when no parent provided', () => {
      const traceStart = 0n;
      const traceEnd = 100000000n; // 100ms total trace duration

      const span = createMockSpan({
        start_ns: 10000000n, // 10ms into trace
        duration: 20000000n, // 20ms duration
        end_ns: 30000000n
      });

      const wrapper = mount(SpanDurationBar, {
        props: {
          span,
          traceStartTime: traceStart,
          traceEndTime: traceEnd
        }
      });

      const bar = wrapper.find('.span-duration-bar-fill');
      const styles = bar.attributes('style');

      // 10% offset, 20% width relative to 100ms trace
      expect(styles).toContain('left: 10%');
      expect(styles).toContain('width: 20%');
    });

    it('should prefer parentSpan over traceStartTime and traceEndTime', () => {
      const parentStart = 1000000000n;
      const parentDuration = 100000000n;

      const parent = createMockSpan({
        start_ns: parentStart,
        duration: parentDuration,
        end_ns: parentStart + parentDuration,
        name: 'parent-span'
      });

      const child = createMockSpan({
        start_ns: parentStart + 10000000n,
        duration: 20000000n,
        end_ns: parentStart + 30000000n,
        name: 'child-span',
        span_id: 'span-2'
      });

      const wrapper = mount(SpanDurationBar, {
        props: {
          span: child,
          parentSpan: parent,
          traceStartTime: 0n, // should be ignored
          traceEndTime: 1000000000n // should be ignored
        }
      });

      const bar = wrapper.find('.span-duration-bar-fill');
      const styles = bar.attributes('style');

      // Should use parent calculations (10%, 20%), not trace calculations
      expect(styles).toContain('left: 10%');
      expect(styles).toContain('width: 20%');
    });
  });
});

