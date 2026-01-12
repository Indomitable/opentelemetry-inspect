<script setup lang="ts">
import {computed, inject} from "vue";
import {useResourceStore} from "../state/resource-store.ts";
import {filterServiceInjectionKey} from "../services/filter-service.ts";
const filterService = inject(filterServiceInjectionKey)!;

const ALL_RESOURCES_KEY = '-';

const resourceStore = useResourceStore();

const selectedResourceKey = computed({
  get: () => {
    if (!filterService.hasFilter('resource.key')) {
      return ALL_RESOURCES_KEY;
    }
    return filterService.selectedResourceForDropdown?.key;
  },
  set: (newKey: string) => {
    if (newKey === ALL_RESOURCES_KEY) {
      filterService.filterByResource(null);
    } else {
      const resource = resourceStore.resources.find(r => r.key === newKey);
      filterService.filterByResource(resource ?? null);
    }
  }
});

const instanceOptions = computed(() => {
  const options = resourceStore.resources.map(r => ({
    label: `${r.service_name} (${r.service_version})`,
    value: r.key,
  }));
  return [{ label: 'All Resources', value: ALL_RESOURCES_KEY }, ...options];
});
</script>

<template>
  <label for="instance-filter">Resource:</label>
  <Select
      id="instance-filter"
      v-model="selectedResourceKey"
      :options="instanceOptions"
      option-label="label"
      option-value="value"
      placeholder="Select Resource"
      size="small"
  />
</template>

<style scoped>

</style>

