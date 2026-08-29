// @ts-nocheck
// Shared expanded-detail stat computation, used by both PicklistRow.vue and
// PicklistUnrankedCard.vue's expanded views so the two don't duplicate the
// same field-derivation logic.

export function computeBasicStats(matchData: unknown[]) {
    if (!matchData.length) return [];

    // Derive numeric fields automatically from the first row
    const numericFields: string[] = [];
    if (matchData[0]) {
        Object.entries(matchData[0]).forEach(([key, val]) => {
            if (typeof val === 'number' && key !== 'id' && !key.includes('match_number') && !key.includes('team_number')) {
                numericFields.push(key);
            }
        });
    }

    return numericFields.slice(0, 8).map((field) => {
        const values = matchData.map(row => row[field]).filter(v => typeof v === 'number');
        const avg = values.length ? (values.reduce((a, b) => a + b, 0) / values.length) : 0;
        const max = values.length ? Math.max(...values) : 0;
        return { label: formatFieldLabel(field), avg: avg.toFixed(1), max };
    });
}

export function formatFieldLabel(field: string) {
    return field
        .replace(/^(prematch_|postmatch_|auto_|teleop_|endgame_)/g, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

export const FLAG_STATS = [
    { key: 'auto_failed', label: 'Auto Fail %' },
    { key: 'postmatch_broke', label: 'Break %' },
    { key: 'postmatch_died', label: 'Die %' },
    { key: 'postmatch_beached', label: 'Beach %' },
    { key: 'postmatch_played_defense', label: 'Defense %' }
];

export function computeFlagStats(matchData: unknown[]) {
    if (!matchData.length) return [];
    return FLAG_STATS.map(({ key, label }) => {
        const count = matchData.filter(row => !!row[key]).length;
        const pct = (count / matchData.length) * 100;
        return { label, pct: pct.toFixed(0), count, total: matchData.length };
    });
}
