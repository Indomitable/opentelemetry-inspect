<script setup lang="ts">
import {computed, ref} from "vue";
import {useResourceStore} from "../state/resource-store.ts";

const emits = defineEmits<{
  (e: 'update:model-value', value: string): void
}>();

const selectedInstanceId = ref<string>('-');
emits('update:model-value', '-');
const resourceStore = useResourceStore();
const instanceOptions = computed(() => {
  const options = resourceStore.resources.map(r => ({
    label: `${r.service_name} (${r.service_version})`,
    value: r.service_instance_id,
  }));
  return [{ label: 'All Resources', value: '-' }, ...options];
});

const onModelValueUpdate = (value: string) => {
  emits('update:model-value', value);
};

</script>

<template>
  <label for="instance-filter">Resource:</label>
  <Select
      id="instance-filter"
      v-model="selectedInstanceId"
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