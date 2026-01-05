import {acceptHMRUpdate, defineStore} from "pinia";
import {mapSpanDtoToSpan, Span, SpanDto} from "../domain/traces.ts";
import {useResourceStore} from "./resource-store.ts";

export const useTracesStore = defineStore('traces', {
    state: () => ({
        // keep roots only here; full lookup is in the index
        spans: [] as Span[],
        index: {} as Record<string, Span>,
        _orphans: {} as Record<string, Span[]>
    }),
    getters: {
        totalCount: (state) => Object.keys(state.index).length,
        // flattened list of spans for components that expect a flat array
        flatSpans: (state) => Object.values(state.index)
    },
    actions: {
        addSpan(dto: SpanDto) {
            const key = `${dto.trace_id}-${dto.span_id}`;
            if (this.index[key]) {
                // span already exists
                return;
            }

            const span = mapSpanDtoToSpan(dto);
            const resourceStore = useResourceStore();
            resourceStore.addResource(span.resource);

            this.index[key] = span;
            const orphans = this._orphans[key];
            if (orphans && orphans.length > 0) {
                // if there are orphan spans and this span is their parent, attach them
                span.children.push(...orphans);
                // remove orphan from roots
                this.spans = this.spans.filter(s => !(s.trace_id === span.trace_id && orphans.some(o => s.span_id === o.span_id)));
                // clean up the orphans map
                delete this._orphans[key];
            }

            if (!span.parent_span_id) {
                // no parent: place as root (top-level)
                this.spans.push(span);
            } else {
                const parentKey = `${span.trace_id}-${span.parent_span_id}`;
                const parent = this.index[parentKey];
                if (parent) {
                    // parent exists: add as child
                    parent.children.push(span);
                } else {
                    // parent missing: keep as root for display, and register as orphan
                    this.spans.push(span);
                    if (!this._orphans[parentKey]) {
                        this._orphans[parentKey] = [];
                    }
                    this._orphans[parentKey].push(span);
                }
            }
        }
    }
});

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useTracesStore, import.meta.hot))
}
