import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import LogsDetailsView from '../logs-details-view.vue';
import type { Log } from '../../domain/logs';
import { FilterService, filterServiceInjectionKey } from '../../services/filter-service';

describe('LogsDetailsView Component', () => {
  const mockLog: Log = {
    timestamp: '2024-01-01T00:00:00Z',
    time_unix_nano: '1000000000',
    time_ns: 1000000000n,
    logTimeStamp: new Date('2024-01-01T00:00:00Z'),
    severity: 'INFO',
    message: 'test log message',
    scope: 'test-scope',
    trace_id: 'trace-1',
    span_id: 'span-1',
    event_name: 'test-event',
    resource: {
      key: 'resource-key',
      service_name: 'test-service',
      service_version: '1.0.0',
      service_namespace: 'test-ns',
      service_instance_id: 'instance-1',
      attributes: {}
    },
    tags: {
      'custom.tag': 'tag-value'
    }
  };

  beforeEach(() => {
    localStorage.clear();
  });

  const mountComponent = () => mount(LogsDetailsView, {
    props: {
      log: mockLog
    },
    global: {
      provide: {
        [filterServiceInjectionKey]: new FilterService("test")
      }
    }
  });

  it('renders log details correctly', () => {
    const wrapper = mountComponent();

    const text = wrapper.text();
    expect(text).toContain('Log Details');
    expect(text).toContain('test log message');
    expect(text).toContain('INFO');
    expect(text).toContain('test-scope');
    expect(text).toContain('trace-1');
    expect(text).toContain('span-1');
    expect(text).toContain('test-event');
  });

  it('renders attributes', () => {
    const wrapper = mountComponent();

    const text = wrapper.text();
    expect(text).toContain('Attributes');
    expect(text).toContain('custom.tag');
    expect(text).toContain('tag-value');
  });

  it('renders resource info', () => {
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
