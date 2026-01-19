import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ResourceSelector from '../resource-selector.vue';
import { useResourceStore } from '../../state/resource-store';
import type { Resource } from '../../domain/resources';
import { FilterService, filterServiceInjectionKey } from '../../services/filter-service';
import PrimeVue from 'primevue/config';
import Select from 'primevue/select';

describe('ResourceSelector Component', () => {
  const mockResource1: Resource = {
    key: 'service-a|1.0.0',
    service_name: 'service-a',
    service_version: '1.0.0',
    service_namespace: 'default',
    service_instance_id: 'inst-1',
    attributes: {}
  };

  const mockResource2: Resource = {
    key: 'service-b|2.0.0',
    service_name: 'service-b',
    service_version: '2.0.0',
    service_namespace: 'default',
    service_instance_id: 'inst-2',
    attributes: {}
  };

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mountComponent = () => {
    return mount(ResourceSelector, {
      global: {
        plugins: [PrimeVue],
        components: {
          Select
        },
        provide: {
          [filterServiceInjectionKey]: new FilterService("test")
        }
      }
    });
  };

  it('renders without emitting on mount', () => {
    const wrapper = mountComponent();
    expect(wrapper.emitted()).toEqual({});
  });

  it('provides all resources option and store resources', () => {
    const resourceStore = useResourceStore();
    resourceStore.resources = [mockResource1, mockResource2];

    const wrapper = mountComponent();
    const select = wrapper.findComponent(Select);
    const options = select.props('options')!;

    expect(options).toHaveLength(3);
    expect(options[0]).toEqual({ label: 'All Resources', value: '-' });
    expect(options[1]).toEqual({ label: 'service-a (1.0.0)', value: 'service-a|1.0.0' });
    expect(options[2]).toEqual({ label: 'service-b (2.0.0)', value: 'service-b|2.0.0' });
  });

  it('filters selected resource when changed', async () => {
    const resourceStore = useResourceStore();
    resourceStore.resources = [mockResource1, mockResource2];

    const filterService = new FilterService("test");
    const wrapper = mount(ResourceSelector, {
      global: {
        plugins: [PrimeVue],
        components: {
          Select
        },
        provide: {
          [filterServiceInjectionKey]: filterService
        }
      }
    });

    const select = wrapper.findComponent(Select);

    // Simulate selecting service-a
    select.vm.$emit('update:modelValue', 'service-a|1.0.0');

    expect(filterService.hasFilter('resource.key')).toBe(true);
    expect(filterService.selectedResourceKey).toEqual(mockResource1.key);
  });

  it('clears filter when All Resources is selected', async () => {
    const resourceStore = useResourceStore();
    resourceStore.resources = [mockResource1];

    const filterService = new FilterService("test");
    const wrapper = mount(ResourceSelector, {
      global: {
        plugins: [PrimeVue],
        components: {
          Select
        },
        provide: {
          [filterServiceInjectionKey]: filterService
        }
      }
    });

    const select = wrapper.findComponent(Select);

    // First select something
    select.vm.$emit('update:modelValue', 'service-a|1.0.0');
    // Then select All Resources
    select.vm.$emit('update:modelValue', '-');

    expect(filterService.hasFilter('resource.key')).toBe(false);
    expect(filterService.selectedResourceKey).toBeNull();
  });
});
