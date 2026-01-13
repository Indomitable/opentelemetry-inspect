import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SpanDetailsView from '../span-details-view.vue';
import type { Span } from '../../domain/traces';
import { FilterService, filterServiceInjectionKey } from '../../services/filter-service';

describe('SpanDetailsView Component', () => {
  const mockSpan: Span = {
    start_time: '2024-01-01T00:00:00Z',
    end_time: '2024-01-01T00:00:01Z',
    start_time_unix_nano: '1000000000',
    end_time_unix_nano: '2000000000',
    start_ns: 1000000000n,
    end_ns: 2000000000n,
    duration: 1000000000n,
    scope: 'test-scope',
    name: 'test-span',
    trace_id: 'trace-1',
    span_id: 'span-1',
    parent_span_id: 'parent-1',
    kind: 'SERVER',
    status: {
      message: 'OK',
      code: '0'
    },
    resource: {
      key: 'resource-key',
      service_name: 'test-service',
      service_version: '1.0.0',
      service_namespace: 'test-ns',
      service_instance_id: 'instance-1',
      attributes: {}
    },
    tags: {
      'http.method': 'GET',
      'http.status_code': '200'
    },
    events: [
      {
        name: 'event-1',
        timestamp: '2024-01-01T00:00:00.500Z',
        attributes: { 'attr1': 'val1' }
      }
    ],
    links: [],
    children: []
  };

  const mountComponent = () => mount(SpanDetailsView, {
    props: {
      span: mockSpan
    },
    global: {
      provide: {
        [filterServiceInjectionKey]: new FilterService()
      }
    }
  });

  it('renders span details correctly', () => {
    const wrapper = mountComponent();

    const text = wrapper.text();
    expect(text).toContain('Span Details');
    expect(text).toContain('test-span');
    expect(text).toContain('test-scope');
    expect(text).toContain('SERVER');
    expect(text).toContain('trace-1');
    expect(text).toContain('span-1');
    expect(text).toContain('parent-1');
  });

  it('renders attributes', () => {
    const wrapper = mountComponent();

    const text = wrapper.text();
    expect(text).toContain('Attributes');
    expect(text).toContain('http.method');
    expect(text).toContain('GET');
    expect(text).toContain('http.status_code');
    expect(text).toContain('200');
  });

  it('renders events', () => {
    const wrapper = mountComponent();

    const text = wrapper.text();
    expect(text).toContain('Events');
    expect(text).toContain('event-1');
    expect(text).toContain('attr1');
    expect(text).toContain('val1');
  });

  it('renders resource info via ResourceDetailsView', () => {
    const wrapper = mountComponent();

    expect(wrapper.text()).toContain('Resource Info');
    expect(wrapper.text()).toContain('test-service');
  });

  it('emits close event when close button is clicked', async () => {
    const wrapper = mountComponent();

    const closeBtn = wrapper.find('.close-btn');
    await closeBtn.trigger('click');

    expect(wrapper.emitted()).toHaveProperty('close');
  });
});
