export const sortBigIntAsc = (a: bigint, b: bigint): number => {
    return a < b ? -1 : a > b ? 1 : 0;
}

export const sortBigIntDesc = (a: bigint, b: bigint): number => {
    return sortBigIntAsc(b, a);
}
