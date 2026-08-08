// Tiny formatting helpers. Pure, tested, and deliberately boring.

/** Escape text for interpolation into markup strings. */
export function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Clamp a stat to the Armor 3.0 range so a weird profile cannot break bars. */
export function clampStat(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(200, Math.round(value)));
}
