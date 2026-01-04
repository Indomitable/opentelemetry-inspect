import {acceptHMRUpdate, defineStore} from "pinia";
import {Resource} from "../domain/resources.ts";

export const useResourceStore = defineStore('resources', {
    state: () => ({
        resources: [] as Resource[]
    }),
    actions: {
        addResource(resource: Resource) {
            if (!this.resources.some(r =>
                r.service_name === resource.service_name &&
                r.service_namespace === resource.service_namespace &&
                r.service_instance_id === resource.service_instance_id)) {
                this.resources.push(resource);
            }
        }
    }
});

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useResourceStore, import.meta.hot))
}
