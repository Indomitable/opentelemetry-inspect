import {ref, Ref, watch} from "vue";

export class StorageService {
    public createStorageItem<T extends string|number|boolean>(key: string, getterOrDefault: ((item: string|null) => T)|T): Ref<T> {
        const persistedValue = this.read(key);
        let value = typeof getterOrDefault === 'function'
            ? getterOrDefault(persistedValue)
            : (!persistedValue ? getterOrDefault : JSON.parse(persistedValue) as T);
        const item = ref<T>(value);
        watch(item, (newValue) => this.write(key, JSON.stringify(newValue)));
        return item as Ref<T>;
    }

    public write(key: string, value: string) {
        localStorage.setItem(key, value);
    }

    public read(key: string): string {
        return localStorage.getItem(key) ?? '';
    }

    public remove(key: string): void {
        return localStorage.removeItem(key);
    }

    public *iterate(prefix: string): Iterable<[string, string]> {
        const regEx = new RegExp(`^${prefix}-filter-`)
        for (let [key, value] of Object.entries(localStorage)) {
            if (regEx.test(key)) {
                yield [key.replace(regEx, ''), value];
            }
        }
    }
}
