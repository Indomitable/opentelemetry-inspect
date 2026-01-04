<script setup lang="ts">
  import {Resource} from "../domain/resources.ts";

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
    </div>
    <div class="details-row">
      <div>service.name</div>
      <div>{{ resource.service_name }}</div>
    </div>
    <div class="details-row">
      <div>service.version</div>
      <div>{{ resource.service_version }}</div>
    </div>
    <div class="details-row">
      <div>service.namespace</div>
      <div>{{ resource.service_namespace }}</div>
    </div>
    <div class="details-row">
      <div>service.instance.id</div>
      <div>{{ resource.service_instance_id }}</div>
    </div>
    <div v-for="(value, key) in resource.attributes" :key="key" class="details-row">
      <div>{{ key }}</div>
      <div>{{ value }}</div>
    </div>
  </div>
</template>

<style scoped>

</style>