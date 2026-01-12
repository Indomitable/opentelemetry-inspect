<script setup lang="ts" generic="T">
import {inject} from "vue";
import {filterServiceInjectionKey} from "../services/filter-service.ts";
const filterService = inject(filterServiceInjectionKey)!;
const props = defineProps<{
  value: string,
  filterKey: string,
  title?: string,
}>()

function toggleFilter() {
  if (filterService.hasFilter(props.filterKey)) {
    filterService.removeFilter(props.filterKey);
  } else {
    filterService.addFilter(props.filterKey, props.value)
  }
}

function getFilterIcon(): string {
  return 'pi filter-button ' + (filterService.hasFilter(props.filterKey) ? 'pi-filter-fill filter-button--active' : 'pi-filter');
}

const title = props.title ?? `Filter by ${props.filterKey}`;
</script>

<template>
  <button :class="getFilterIcon()" @click="toggleFilter()" :title="title" />
</template>

<style scoped>
.filter-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  font-size: 1rem;
}

.filter-button:hover {
  color: #333;
}

@media (prefers-color-scheme: dark) {
  .filter-button:hover {
    color: #ccc;
  }
}

.filter-button--active {
  color: #1976d2;
}
</style>