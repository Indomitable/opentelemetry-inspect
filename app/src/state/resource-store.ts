import {acceptHMRUpdate, defineStore} from "pinia";
import type {Resource} from "../domain/resources.ts";

export const useResourceStore = defineStore('resources', {
    state: () => ({
        resources: [] as Resource[]
    }),
    actions: {
        addResource(resource: Resource) {
            if (!this.resources.some(r =>r.key === resource.key)) {
                this.resources.push(resource);
            }
        }
    }
});

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useResourceStore, import.meta.hot))
}
