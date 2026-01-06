export function insertSortedDesc<T, K extends keyof T>(logs: T[], log: T, field: T[K] extends bigint ? K : never) {
    // keep logs ordered by time descending.
    // logs generally should come in order, so the search should be fast.
    let index = logs.length;
    for (let i = 0; i < logs.length; i++) {
        if (logs[i][field] < log[field]) {
            index = i;
            break;
        }
    }
    logs.splice(index, 0, log);
}
