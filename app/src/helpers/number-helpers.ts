export const formatSI = (num: number, precision: number = 2): string => {
    if (num === 0) return '0';
    const suffixes = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
    const i = Math.floor(Math.log10(Math.abs(num)) / 3);
    if (i <= 0) return num.toString();
    const suffix = suffixes[i] || '';
    const scaled = num / Math.pow(10, i * 3);
    
    // Remove trailing zeros after decimal point if any
    return scaled.toFixed(precision).replace(/\.?0+$/, '') + suffix;
};

export const formatAdaptive = (value: number, ticks: { value: number }[]): string => {
    if (ticks.length < 2) return formatSI(value);

    // Find the smallest non-zero difference between adjacent ticks
    let minDiff = Infinity;
    for (let i = 1; i < ticks.length; i++) {
        const diff = Math.abs(ticks[i].value - ticks[i - 1].value);
        if (diff > 0 && diff < minDiff) {
            minDiff = diff;
        }
    }

    if (minDiff === Infinity) return formatSI(value);

    const maxValue = Math.max(...ticks.map(t => Math.abs(t.value)));
    if (maxValue === 0) return '0';

    const i = Math.floor(Math.log10(maxValue) / 3);
    const unitFactor = Math.pow(10, i * 3);

    if (i > 0 && minDiff < unitFactor * 0.01) {
        // Less than 1% of the SI unit factor: keep real values
        // Limit precision to avoid JS number precision problems (e.g. 1004.0000000002)
        return value.toFixed(2).replace(/\.?0+$/, '');
    } else {
        // 1% or more of the SI unit factor: use SI formatting
        return formatSI(value, 2);
    }
};
