import {InjectionKey, ref} from "vue";
import {Resource} from "../domain/resources.ts";

export class FilterService {
    private readonly filters = ref<Record<string, string>>({});
    private readonly selectedResource = ref<Resource|null>(null);

    addFilter(key: string, value: string) {
        this.filters.value[key] = value;
    }

    removeFilter(key: string) {
        if (key === 'resource.key') {
            this.selectedResource.value = null;
        }
        delete this.filters.value[key];
    }

    hasFilter(key: string) {
        return this.filters.value[key] !== undefined;
    }

    matchesFilter(obj: any): boolean {
        if (!Object.keys(this.filters.value).length) {
            return true;
        }

        for (const [key, value] of Object.entries(this.filters.value)) {
            const keyParts = key.split('.');
            let item = obj as Record<string, any> as any;
            for (const part of keyParts) {
                if (!(part in item)) return false;
                item = item[part];
            }
            if (item == value) {
                return true;
            }
        }
        return false;
    }

    filterByResource(resource: Resource|null) {
        this.selectedResource.value = resource;
        if (resource) {
            this.addFilter('resource.key', resource.key);
        } else {
            this.removeFilter('resource.key');
        }
    }

    get activeFilters(): FilterEntry[] {
        return Object.entries(this.filters.value).map(([key, value]) => ({
            key,
            value,
            display: key === 'resource.key' ? 'resource' : key
        }));
    }

    get selectedResourceForDropdown(): Resource|null {
        return this.selectedResource.value;
    }
}


export interface FilterEntry {
  key: string;
  value: string;
  display: string;
}

export const filterServiceInjectionKey: InjectionKey<FilterService> = Symbol('FilterServiceInjectionKey');
