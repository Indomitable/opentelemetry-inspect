import {ref, Ref, watch} from "vue";

export function useStorage() {
    const createStorageItem = <T extends string|number|boolean>(key: string, getterOrDefault: ((item: string|null) => T)|T): Ref<T> => {
        const persistedValue = localStorage.getItem(key);
        let value = typeof getterOrDefault === 'function'
            ? getterOrDefault(persistedValue)
            : (!persistedValue ? getterOrDefault : JSON.parse(persistedValue) as T);
        const item = ref<T>(value);
        watch(item, (newValue) => localStorage.setItem(key, JSON.stringify(newValue)));
        return item as Ref<T>;
    };

    return {
        createStorageItem
    };
}