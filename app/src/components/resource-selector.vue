<script setup lang="ts">
import {computed, ref} from "vue";
import {useResourceStore} from "../state/resource-store.ts";
import {Resource} from "../domain/resources.ts";

const ALL_RESOURCES_KEY='-';
const emits = defineEmits<{
  (e: 'update:model-value', value: Resource|null): void
}>();

const selectedResourceKey = ref<string>(ALL_RESOURCES_KEY);
emits('update:model-value', null);
const resourceStore = useResourceStore();
const instanceOptions = computed(() => {
  const options = resourceStore.resources.map(r => ({
    label: `${r.service_name} (${r.service_version})`,
    value: r.key,
  }));
  return [{ label: 'All Resources', value: ALL_RESOURCES_KEY }, ...options];
});

const onModelValueUpdate = (resourceKey: string) => {
  if (resourceKey === ALL_RESOURCES_KEY) {
    emits('update:model-value', null);
  } else {
    const resource = resourceStore.resources.find(r => r.key === resourceKey);
    emits('update:model-value', resource ?? null);
  }
};

</script>

<template>
  <label for="instance-filter">Resource:</label>
  <Select
      id="instance-filter"
      v-model="selectedResourceKey"
      :options="instanceOptions"
      @update:model-value="onModelValueUpdate"
      option-label="label"
      option-value="value"
      placeholder="Select Resource"
      size="small"
  />
</template>

<style scoped>

</style>