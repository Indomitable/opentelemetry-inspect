import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTracesStore } from '../traces-store';
import type { SpanDto } from '../../domain/traces';

// Mock the resource store
vi.mock('../resource-store', () => ({
  useResourceStore: vi.fn(() => ({
    addResource: vi.fn()
  }))
}));

describe('TracesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const createMockSpanDto = (overrides: Partial<SpanDto> = {}): SpanDto => ({
    start_time: '2024-01-01T00:00:00.000000000Z',
    end_time: '2024-01-01T00:00:01.000000000Z',
    start_time_unix_nano: "1704067200000000000",
    end_time_unix_nano: "1704067201000000000",
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
    ...overrides
  });

  describe('Case 1: No parent - add to root', () => {
    it('should add span without parent_span_id to spans (root)', () => {
      const store = useTracesStore();
      const spanDto = createMockSpanDto({
        span_id: 'root-span',
        parent_span_id: undefined
      });

      store.addSpan(spanDto);

      // Check span is in roots
      expect(store.spans).toHaveLength(1);
      expect(store.spans[0].span_id).toBe('root-span');
      expect(store.spans[0].parent_span_id).toBeUndefined();

      // Check span is in index
      const key = 'trace-1-root-span';
      expect(store.index[key]).toBeDefined();
      expect(store.index[key].span_id).toBe('root-span');

      // Should not be in orphans
      expect(Object.keys(store._orphans)).toHaveLength(0);
    });

    it('should add multiple root spans correctly', () => {
      const store = useTracesStore();

      const span1 = createMockSpanDto({
        span_id: 'root-1',
        parent_span_id: undefined
      });

      const span2 = createMockSpanDto({
        span_id: 'root-2',
        parent_span_id: undefined
      });

      store.addSpan(span1);
      store.addSpan(span2);

      expect(store.spans).toHaveLength(2);
      expect(store.spans.map(s => s.span_id)).toEqual(['root-1', 'root-2']);
    });
  });

  describe('Case 2: Parent exists - add to children', () => {
    it('should add span as child when parent already exists', () => {
      const store = useTracesStore();

      const parentDto = createMockSpanDto({
        span_id: 'parent-span',
        parent_span_id: undefined
      });

      const childDto = createMockSpanDto({
        span_id: 'child-span',
        parent_span_id: 'parent-span'
      });

      // Add parent first
      store.addSpan(parentDto);
      expect(store.spans).toHaveLength(1);

      // Add child
      store.addSpan(childDto);

      // Parent should still be the only root
      expect(store.spans).toHaveLength(1);
      expect(store.spans[0].span_id).toBe('parent-span');

      // Child should be in parent's children
      expect(store.spans[0].children).toHaveLength(1);
      expect(store.spans[0].children[0].span_id).toBe('child-span');

      // Child should be in index
      const childKey = 'trace-1-child-span';
      expect(store.index[childKey]).toBeDefined();
    });

    it('should add multiple children to same parent', () => {
      const store = useTracesStore();

      const parentDto = createMockSpanDto({
        span_id: 'parent',
        parent_span_id: undefined
      });

      const child1Dto = createMockSpanDto({
        span_id: 'child-1',
        parent_span_id: 'parent'
      });

      const child2Dto = createMockSpanDto({
        span_id: 'child-2',
        parent_span_id: 'parent'
      });

      store.addSpan(parentDto);
      store.addSpan(child1Dto);
      store.addSpan(child2Dto);

      expect(store.spans).toHaveLength(1);
      expect(store.spans[0].children).toHaveLength(2);
      expect(store.spans[0].children.map(c => c.span_id)).toEqual(['child-1', 'child-2']);
    });

    it('should create nested tree when grandchildren exist', () => {
      const store = useTracesStore();

      const grandparentDto = createMockSpanDto({
        span_id: 'grandparent',
        parent_span_id: undefined
      });

      const parentDto = createMockSpanDto({
        span_id: 'parent',
        parent_span_id: 'grandparent'
      });

      const childDto = createMockSpanDto({
        span_id: 'child',
        parent_span_id: 'parent'
      });

      store.addSpan(grandparentDto);
      store.addSpan(parentDto);
      store.addSpan(childDto);

      expect(store.spans).toHaveLength(1);
      expect(store.spans[0].children).toHaveLength(1);
      expect(store.spans[0].children[0].children).toHaveLength(1);
      expect(store.spans[0].children[0].children[0].span_id).toBe('child');
    });
  });

  describe('Case 3: Parent missing - add to root and orphans', () => {
    it('should add span with missing parent to root and orphans map', () => {
      const store = useTracesStore();

      const orphanDto = createMockSpanDto({
        span_id: 'orphan-child',
        parent_span_id: 'missing-parent'
      });

      store.addSpan(orphanDto);

      // Span should be in roots
      expect(store.spans).toHaveLength(1);
      expect(store.spans[0].span_id).toBe('orphan-child');

      // Span should be in index
      const key = 'trace-1-orphan-child';
      expect(store.index[key]).toBeDefined();

      // Span should be registered in orphans under parent key
      const parentKey = 'trace-1-missing-parent';
      expect(store._orphans[parentKey]).toBeDefined();
      expect(store._orphans[parentKey]).toHaveLength(1);
      expect(store._orphans[parentKey][0].span_id).toBe('orphan-child');
    });

    it('should handle multiple orphans waiting for same parent', () => {
      const store = useTracesStore();

      const orphan1Dto = createMockSpanDto({
        span_id: 'orphan-1',
        parent_span_id: 'missing-parent'
      });

      const orphan2Dto = createMockSpanDto({
        span_id: 'orphan-2',
        parent_span_id: 'missing-parent'
      });

      store.addSpan(orphan1Dto);
      store.addSpan(orphan2Dto);

      // Both should be in roots
      expect(store.spans).toHaveLength(2);

      // Both should be registered as orphans
      const parentKey = 'trace-1-missing-parent';
      expect(store._orphans[parentKey]).toHaveLength(2);
      expect(store._orphans[parentKey].map(o => o.span_id)).toEqual(['orphan-1', 'orphan-2']);
    });
  });

  describe('Case 4: Parent arrives later - attach orphans and remove from root', () => {
    it('should attach orphan children when parent arrives', () => {
      const store = useTracesStore();

      const parentDto = createMockSpanDto({
        span_id: 'parent',
        parent_span_id: undefined
      });

      const orphanDto = createMockSpanDto({
        span_id: 'orphan-child',
        parent_span_id: 'parent'
      });

      // Add orphan first (parent missing)
      store.addSpan(orphanDto);
      expect(store.spans).toHaveLength(1);
      expect(store.spans[0].span_id).toBe('orphan-child');

      // Add parent
      store.addSpan(parentDto);

      // Now parent should be the only root
      expect(store.spans).toHaveLength(1);
      expect(store.spans[0].span_id).toBe('parent');

      // Orphan should now be child of parent
      expect(store.spans[0].children).toHaveLength(1);
      expect(store.spans[0].children[0].span_id).toBe('orphan-child');

      // Orphans map should be cleaned
      const parentKey = 'trace-1-parent';
      expect(store._orphans[parentKey]).toBeUndefined();
    });

    it('should attach multiple orphans when parent arrives', () => {
      const store = useTracesStore();

      const parentDto = createMockSpanDto({
        span_id: 'parent',
        parent_span_id: undefined
      });

      const orphan1Dto = createMockSpanDto({
        span_id: 'orphan-1',
        parent_span_id: 'parent'
      });

      const orphan2Dto = createMockSpanDto({
        span_id: 'orphan-2',
        parent_span_id: 'parent'
      });

      // Add orphans first
      store.addSpan(orphan1Dto);
      store.addSpan(orphan2Dto);
      expect(store.spans).toHaveLength(2);

      // Add parent
      store.addSpan(parentDto);

      // Parent should be only root
      expect(store.spans).toHaveLength(1);
      expect(store.spans[0].span_id).toBe('parent');

      // Both orphans should be attached
      expect(store.spans[0].children).toHaveLength(2);
      expect(store.spans[0].children.map(c => c.span_id)).toEqual(['orphan-1', 'orphan-2']);
    });

    it('should handle complex tree reattachment scenario', () => {
      const store = useTracesStore();

      // Scenario: orphan2 arrives, then orphan1, then parent arrives
      const orphan2Dto = createMockSpanDto({
        span_id: 'orphan-2',
        parent_span_id: 'parent'
      });

      const orphan1Dto = createMockSpanDto({
        span_id: 'orphan-1',
        parent_span_id: 'parent'
      });

      const parentDto = createMockSpanDto({
        span_id: 'parent',
        parent_span_id: undefined
      });

      store.addSpan(orphan2Dto);
      expect(store.spans).toHaveLength(1);

      store.addSpan(orphan1Dto);
      expect(store.spans).toHaveLength(2);

      store.addSpan(parentDto);
      expect(store.spans).toHaveLength(1);
      expect(store.spans[0].children).toHaveLength(2);
    });
  });

  describe('Index and state management', () => {
    it('should maintain correct totalCount', () => {
      const store = useTracesStore();

      const span1 = createMockSpanDto({
        span_id: 'span-1',
        parent_span_id: undefined
      });

      const span2 = createMockSpanDto({
        span_id: 'span-2',
        parent_span_id: 'span-1'
      });

      store.addSpan(span1);
      expect(store.totalCount).toBe(1);

      store.addSpan(span2);
      expect(store.totalCount).toBe(2);
    });

    it('should use composite key for index', () => {
      const store = useTracesStore();

      const spanDto = createMockSpanDto({
        trace_id: 'trace-abc',
        span_id: 'span-xyz'
      });

      store.addSpan(spanDto);

      const compositeKey = 'trace-abc-span-xyz';
      expect(store.index[compositeKey]).toBeDefined();
      expect(store.index[compositeKey].span_id).toBe('span-xyz');
    });

    it('should prevent duplicate spans', () => {
      const store = useTracesStore();

      const spanDto = createMockSpanDto({
        span_id: 'unique-span'
      });

      store.addSpan(spanDto);
      expect(store.spans).toHaveLength(1);

      // Try to add same span again
      store.addSpan(spanDto);
      expect(store.spans).toHaveLength(1); // Should not duplicate
      expect(store.totalCount).toBe(1);
    });

    it('should handle different traces with same span_id', () => {
      const store = useTracesStore();

      const span1Dto = createMockSpanDto({
        trace_id: 'trace-1',
        span_id: 'span-x'
      });

      const span2Dto = createMockSpanDto({
        trace_id: 'trace-2',
        span_id: 'span-x' // same span_id but different trace
      });

      store.addSpan(span1Dto);
      store.addSpan(span2Dto);

      expect(store.totalCount).toBe(2);
      expect(store.spans).toHaveLength(2);

      // Should have different composite keys
      expect(store.index['trace-1-span-x']).toBeDefined();
      expect(store.index['trace-2-span-x']).toBeDefined();
    });
  });

  describe('flatSpans getter', () => {
    it('should return all spans in flat array', () => {
      const store = useTracesStore();

      const parent = createMockSpanDto({
        span_id: 'parent',
        parent_span_id: undefined
      });

      const child = createMockSpanDto({
        span_id: 'child',
        parent_span_id: 'parent'
      });

      store.addSpan(parent);
      store.addSpan(child);

      expect(store.flatSpans).toHaveLength(2);
      expect(store.flatSpans.map(s => s.span_id)).toContain('parent');
      expect(store.flatSpans.map(s => s.span_id)).toContain('child');
    });
  });
});

