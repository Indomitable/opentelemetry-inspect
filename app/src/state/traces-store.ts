import {acceptHMRUpdate, defineStore} from "pinia";
import {mapSpanDtoToSpan, Span, SpanDto} from "../domain/traces.ts";
import {useResourceStore} from "./resource-store.ts";
import {computed, ref} from "vue";
import {Resource} from "../domain/resources.ts";

export const useTracesStore = defineStore('traces', () => {
    const spans = ref<Span[]>([]);
    const index = ref<Record<string, Span>>({});
    const _orphans = ref<Record<string, Span[]>>({});

    const resourceStore = useResourceStore();
    const totalCount = computed(() => Object.keys(index.value).length);
    const flatSpans = computed(() => Object.values(index.value));
    //const spansForResource = computed(() => (resource: string) => spans.value.filter(s => s.resource.key === resource));

    function addSpan(dto: SpanDto) {
        const key = `${dto.trace_id}-${dto.span_id}`;
        if (index.value[key]) {
            // span already exists
            return;
        }

        const span = mapSpanDtoToSpan(dto);

        resourceStore.addResource(span.resource);

        index.value[key] = span;
        const orphans = _orphans.value[key];
        if (orphans && orphans.length > 0) {
            // if there are orphan spans and this span is their parent, attach them
            span.children.push(...orphans);
            // remove orphan from roots
            spans.value = spans.value.filter(s => !(s.trace_id === span.trace_id && orphans.some(o => s.span_id === o.span_id)));
            // clean up the orphans map
            delete _orphans.value[key];
        }

        if (!span.parent_span_id) {
            // no parent: place as root (top-level)
            spans.value.push(span);
        } else {
            const parentKey = `${span.trace_id}-${span.parent_span_id}`;
            const parent = index.value[parentKey];
            if (parent) {
                // parent exists: add as child
                parent.children.push(span);
            } else {
                // parent missing: keep as root for display, and register as orphan
                spans.value.push(span);
                if (!_orphans.value[parentKey]) {
                    _orphans.value[parentKey] = [];
                }
                _orphans.value[parentKey].push(span);
            }
        }
    }

    function spansForResource(resource: Resource) {
        return spans.value.filter(s => s.resource.key === resource.key);
    }

    return {
        spans,
        index,
        _orphans,
        totalCount,
        flatSpans,
        addSpan,
        spansForResource,
    };
});

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useTracesStore, import.meta.hot))
}
