import { describe, it, expect } from 'vitest';
import { formatSI, formatAdaptive } from '../number-helpers';

describe('number-helpers', () => {
    describe('formatSI', () => {
        it('should format 0 correctly', () => {
            expect(formatSI(0)).toBe('0');
        });

        it('should not format small numbers', () => {
            expect(formatSI(123)).toBe('123');
            expect(formatSI(999)).toBe('999');
        });

        it('should format thousands (K)', () => {
            expect(formatSI(1000)).toBe('1K');
            expect(formatSI(1500)).toBe('1.5K');
            expect(formatSI(10000)).toBe('10K');
        });

        it('should format millions (M)', () => {
            expect(formatSI(1000000)).toBe('1M');
            expect(formatSI(2500000)).toBe('2.5M');
        });

        it('should format billions (G)', () => {
            expect(formatSI(1000000000)).toBe('1G');
        });

        it('should handle negative numbers', () => {
            expect(formatSI(-1000)).toBe('-1K');
            expect(formatSI(-1000000)).toBe('-1M');
        });

        it('should use specified precision', () => {
            expect(formatSI(1234, 1)).toBe('1.2K');
            expect(formatSI(1234, 0)).toBe('1K');
        });
        
        it('should handle very large numbers', () => {
            expect(formatSI(1e12)).toBe('1T');
            expect(formatSI(1e15)).toBe('1P');
        });
    });

    describe('formatAdaptive', () => {
        it('should keep real values if difference is less than 1%', () => {
            const ticks = [{ value: 1000 }, { value: 1001 }, { value: 1002 }];
            expect(formatAdaptive(1001, ticks)).toBe('1001');
        });

        it('should use SI if difference is exactly 1%', () => {
            const ticks = [{ value: 1000 }, { value: 1010 }];
            expect(formatAdaptive(1000, ticks)).toBe('1K');
            expect(formatAdaptive(1010, ticks)).toBe('1.01K');
        });

        it('should use SI if difference is 10%', () => {
            const ticks = [{ value: 1000 }, { value: 1100 }];
            expect(formatAdaptive(1000, ticks)).toBe('1K');
            expect(formatAdaptive(1100, ticks)).toBe('1.1K');
        });

        it('should handle zero gracefully', () => {
            const ticks = [{ value: 0 }, { value: 100 }];
            expect(formatAdaptive(0, ticks)).toBe('0');
            expect(formatAdaptive(100, ticks)).toBe('100');
        });

        it('should handle single tick', () => {
            const ticks = [{ value: 1000 }];
            expect(formatAdaptive(1000, ticks)).toBe('1K');
        });

        it('should handle empty ticks', () => {
            expect(formatAdaptive(1000, [])).toBe('1K');
        });

        it('should format 37600, 37800 etc as K because they are unique in SI', () => {
            const ticks = [{ value: 37600 }, { value: 37800 }, { value: 38000 }, { value: 38200 }];
            expect(formatAdaptive(37600, ticks)).toBe('37.6K');
            expect(formatAdaptive(37800, ticks)).toBe('37.8K');
            expect(formatAdaptive(38000, ticks)).toBe('38K');
            expect(formatAdaptive(38200, ticks)).toBe('38.2K');
        });

        it('should avoid JS number precision problems for unformatted values', () => {
            const ticks = [{ value: 1004.0000000002 }, { value: 1005.0000000003 }];
            expect(formatAdaptive(1004.0000000002, ticks)).toBe('1004');
        });
    });
});
