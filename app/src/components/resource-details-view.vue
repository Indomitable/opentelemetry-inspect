<script setup lang="ts">
  import {Resource} from "../domain/resources.ts";
  import FilterButton from "./filter-button.vue";

  interface ResourceDetailsProps {
    resource: Resource
  }
  const { resource } = defineProps<ResourceDetailsProps>();
</script>

<template>
  <div class="details-table">
    <div class="details-row header">
      <div>Key</div>
      <div>Value</div>
      <div class="details-filter-col"></div>
    </div>
    <div class="details-row">
      <div>service.name</div>
      <div>{{ resource.service_name }}</div>
      <filter-button :filterKey="'resource.service_name'" :value="resource.service_name" :title="'Filter by resource name'" />
    </div>
    <div class="details-row">
      <div>service.version</div>
      <div>{{ resource.service_version }}</div>
      <filter-button :filterKey="'resource.service_version'" :value="resource.service_version" :title="'Filter by resource version'" />
    </div>
    <div class="details-row">
      <div>service.namespace</div>
      <div>{{ resource.service_namespace }}</div>
      <filter-button :filterKey="'resource.service_namespace'" :value="resource.service_namespace" :title="'Filter by resource namespace'" />
    </div>
    <div class="details-row">
      <div>service.instance.id</div>
      <div>{{ resource.service_instance_id }}</div>
      <filter-button :filterKey="'resource.service_instance_id'" :value="resource.service_instance_id" :title="'Filter by resource instance id'" />
    </div>
    <div v-for="(value, key) in resource.attributes" :key="key" class="details-row">
      <div>{{ key }}</div>
      <div>{{ value }}</div>
      <filter-button :filterKey="`resource.attributes.${key}`" :value="value" />
    </div>
  </div>
</template>

<style scoped>

</style>