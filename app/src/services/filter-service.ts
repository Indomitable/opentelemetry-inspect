import {InjectionKey, ref} from "vue";
import {Resource} from "../domain/resources.ts";
import {StorageService} from "./storage-service.ts";

export const ResourceFilterKey = 'resource.key';

export class FilterService {
    private readonly filters = ref<Record<string, string>>({});
    private readonly selectedResource = ref<Resource|null>(null);
    constructor(private readonly prefix: string,
                private readonly storage: StorageService = new StorageService()) {
        for (const [key, value] of this.storage.iterate(prefix)) {
            this.addFilter(key, value);
        }
    }

    addFilter(key: string, value: string) {
        this.filters.value[key] = value;
        this.storage.write(`${this.prefix}-filter-${key}`, value);
    }

    removeFilter(key: string) {
        if (key === ResourceFilterKey) {
            this.selectedResource.value = null;
        }
        delete this.filters.value[key];
        this.storage.remove(`${this.prefix}-filter-${key}`);
    }

    clearAllFilters() {
        const keys = Object.keys(this.filters.value);
        for (const key of keys) {
            this.removeFilter(key);
        }
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
            let found = true;

            for (const part of keyParts) {
                if (!(part in item)) {
                    found = false;
                    break;
                }
                item = item[part];
            }

            if (!found) {
                continue;
            }

            if (item !== value) {
                return false;
            }
        }
        return true;
    }

    filterByResource(resource: Resource|null) {
        this.selectedResource.value = resource;
        if (resource) {
            this.addFilter(ResourceFilterKey, resource.key);
        } else {
            this.removeFilter(ResourceFilterKey);
        }
    }

    get activeFilters(): FilterEntry[] {
        return Object.entries(this.filters.value).map(([key, value]) => ({
            key,
            value,
            display: key === ResourceFilterKey ? 'resource' : key
        }));
    }

    get selectedResourceKey(): string|null {
        return this.filters.value[ResourceFilterKey] ?? null;
    }
}


export interface FilterEntry {
  key: string;
  value: string;
  display: string;
}

export const filterServiceInjectionKey: InjectionKey<FilterService> = Symbol('FilterServiceInjectionKey');
