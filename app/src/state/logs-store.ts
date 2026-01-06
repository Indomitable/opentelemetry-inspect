import {acceptHMRUpdate, defineStore} from "pinia";
import {Log, LogDto, mapLogDtoToLog} from "../domain/logs.ts";
import {useResourceStore} from "./resource-store.ts";
import type {Resource} from "../domain/resources.ts";

export const useLogsStore = defineStore('logs', {
    state: () => ({
        logs: [] as Log[]
    }),
    getters: {
        totalCount: (state) => state.logs.length,
        logsByResource: (state) =>
            (resource: Resource) =>
                state.logs.filter(log => log.resource.key === resource.key),
    },
    actions: {
        addLog(dto: LogDto) {
            const log = mapLogDtoToLog(dto);
            this.logs.push(log);
            const resourceStore = useResourceStore();
            resourceStore.addResource(log.resource);
        }
    }
});

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useLogsStore, import.meta.hot))
}
