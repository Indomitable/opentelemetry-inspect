import {acceptHMRUpdate, defineStore} from "pinia";
import {mapSpanDtoToSpan, Span, SpanDto} from "../domain/traces.ts";
import {useResourceStore} from "./resource-store.ts";

export const useTracesStore = defineStore('traces', {
    state: () => ({
        spans: [] as Span[]
    }),
    getters: {
        totalCount: (state) => state.spans.length,
    },
    actions: {
        addSpan(dto: SpanDto) {
            const span = mapSpanDtoToSpan(dto);
            this.spans.push(span);
            const resourceStore = useResourceStore();
            resourceStore.addResource(span.resource);
        }
    }
});

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useTracesStore, import.meta.hot))
}
