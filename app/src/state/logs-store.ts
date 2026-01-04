import {acceptHMRUpdate, defineStore} from "pinia";
import {Log} from "../domain/logs.ts";
import {useResourceStore} from "./resource-store.ts";

export const useLogsStore = defineStore('logs', {
    state: () => ({
        logs: [] as Log[]
    }),
    getters: {
        totalCount: (state) => state.logs.length,
        logsByInstance: (state) =>
            (instanceId: string) =>
                state.logs.filter(log => log.resource.service_instance_id === instanceId),
    },
    actions: {
        addLog(log: Log) {
            this.logs.push(log);
            const resourceStore = useResourceStore();
            resourceStore.addResource(log.resource);
        }
    }
});

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useLogsStore, import.meta.hot))
}
