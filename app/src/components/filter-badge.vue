<script setup lang="ts">
import {computed, inject} from "vue";
import {filterServiceInjectionKey} from "../services/filter-service.ts";
const filterService = inject(filterServiceInjectionKey)!;
const filters = computed(() => filterService.activeFilters);
</script>

<template>
  <div v-if="filters.length" class="filter-badges">
    <Chip v-for="filter in filters" :key="`${filter.key}-${filter.value}`" :label="`${filter.display}=${filter.value}`"
            removable @remove="filterService.removeFilter(filter.key)" />
  </div>
</template>

<style scoped>
.filter-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
</style>

