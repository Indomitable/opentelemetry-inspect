<script setup lang="ts">
import {computed, inject} from "vue";
import {filterServiceInjectionKey} from "../services/filter-service.ts";
const filterService = inject(filterServiceInjectionKey)!;
const filters = computed(() => filterService.activeFilters);
</script>

<template>
  <div v-if="filters.length" class="filters">
    <Button icon="pi pi-filter-slash"
            severity="danger"
            rounded variant="text"
            @click="filterService.clearAllFilters()"
            v-tooltip.bottom="'Clear all filters'" />
    <div class="filters-content">
      <Chip v-for="filter in filters" :key="`${filter.key}-${filter.value}`" :label="`${filter.display}=${filter.value}`"
              removable @remove="filterService.removeFilter(filter.key)" />
    </div>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.filters-content {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
}
</style>

