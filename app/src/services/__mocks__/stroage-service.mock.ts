export class StorageServiceMock {
    private readonly store: Record<string, string> = {};
    write(key: string, value: string) {
        this.store[key] = value;
    }
    read(key: string) {
        return this.store[key] || '';
    }
    remove(key: string) {
        delete this.store[key];
    }
    *iterate(prefix: string): Iterable<[string, string]> {
            const regEx = new RegExp(`^${prefix}-filter-`);
            for (const [key, value] of Object.entries(this.store)) {
            if (regEx.test(key)) {
                yield [key.replace(regEx, ''), value];
            }
        }
    }
    createStorageItem(): any {}
}
