import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ResourceDetailsView from '../resource-details-view.vue';
import type { Resource } from '../../domain/resources';
import { FilterService, filterServiceInjectionKey } from '../../services/filter-service';

describe('ResourceDetailsView Component', () => {
  const mockResource: Resource = {
    key: 'test-key',
    service_name: 'test-service',
    service_version: '1.0.0',
    service_namespace: 'test-namespace',
    service_instance_id: 'instance-1',
    attributes: {
      'custom.attr': 'value1',
      'env': 'prod'
    }
  };

  beforeEach(() => {
    localStorage.clear();
  });

  const mountComponent = () => mount(ResourceDetailsView, {
    props: {
      resource: mockResource
    },
    global: {
      provide: {
        [filterServiceInjectionKey]: new FilterService()
      }
    }
  });

  it('renders standard resource fields', () => {
    const wrapper = mountComponent();

    const text = wrapper.text();
    expect(text).toContain('test-service');
    expect(text).toContain('1.0.0');
    expect(text).toContain('test-namespace');
    expect(text).toContain('instance-1');
  });

  it('renders custom attributes', () => {
    const wrapper = mountComponent();

    const text = wrapper.text();
    expect(text).toContain('custom.attr');
    expect(text).toContain('value1');
    expect(text).toContain('env');
    expect(text).toContain('prod');
  });

  it('renders table headers', () => {
    const wrapper = mountComponent();

    const header = wrapper.find('.details-row.header');
    expect(header.exists()).toBe(true);
    expect(header.text()).toContain('Key');
    expect(header.text()).toContain('Value');
  });
});
