import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ResourceSelector from '../resource-selector.vue';
import { useResourceStore } from '../../state/resource-store';
import type { Resource } from '../../domain/resources';
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
        }
      }
    });
  };

  it('emits null on mount', () => {
    const wrapper = mountComponent();
    expect(wrapper.emitted('update:model-value')).toBeTruthy();
    expect(wrapper.emitted('update:model-value')![0]).toEqual([null]);
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

  it('emits selected resource when changed', async () => {
    const resourceStore = useResourceStore();
    resourceStore.resources = [mockResource1, mockResource2];

    const wrapper = mountComponent();
    const select = wrapper.findComponent(Select);

    // Simulate selecting service-a
    select.vm.$emit('update:model-value', 'service-a|1.0.0');

    const emissions = wrapper.emitted('update:model-value');
    expect(emissions).toBeTruthy();
    // Index 0 is initial null, Index 1 is the change
    expect(emissions![1]).toEqual([mockResource1]);
  });

  it('emits null when All Resources is selected', async () => {
    const resourceStore = useResourceStore();
    resourceStore.resources = [mockResource1];

    const wrapper = mountComponent();
    const select = wrapper.findComponent(Select);

    // First select something
    select.vm.$emit('update:model-value', 'service-a|1.0.0');
    // Then select All Resources
    select.vm.$emit('update:model-value', '-');

    const emissions = wrapper.emitted('update:model-value');
    expect(emissions![2]).toEqual([null]);
  });
});
