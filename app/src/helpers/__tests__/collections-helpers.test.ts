import {describe, it, expect} from "vitest";
import {insertSortedDesc} from "../collections-helpers.ts";

describe('logs order descending', () => {
   it('no logs add log first', () => {
       let logs = [] as {time_ns: bigint}[];
       let log = {time_ns: BigInt(1)};
       insertSortedDesc(logs, log, 'time_ns');
       expect(logs[0]).toBe(log);
   });

    it('add log first if second is smaller', () => {
        let logs = [
            { time_ns: BigInt(2) },
        ];
        let log = {time_ns: BigInt(3)};
        insertSortedDesc(logs, log, 'time_ns');
        expect(logs[0].time_ns).toBe(BigInt(3));
        expect(logs[1].time_ns).toBe(BigInt(2));
    });

    it('add log last if it smaller than rest', () => {
        let logs = [
            { time_ns: BigInt(3) },
            { time_ns: BigInt(2) },
        ];
        let log = {time_ns: BigInt(1)};
        insertSortedDesc(logs, log, 'time_ns');
        expect(logs[0].time_ns).toBe(BigInt(3));
        expect(logs[1].time_ns).toBe(BigInt(2));
        expect(logs[2].time_ns).toBe(BigInt(1));
    });
});