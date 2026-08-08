// Anti-Champion 2.0, from the 2026-05-29 dev insight: the dedicated champion
// mods are gone, and every weapon carries an intrinsic champion effect decided
// by its frame, with no activation criteria.
//
// The mapping below is the dev insight's, complete. Frames it does not name
// (exotic intrinsic frames, wave frames and so on) get an honest "no mapping
// published" rather than a guess. Each weapon's frame itself is a manifest
// fact, baked into items.json at build time, so nothing here relies on
// remembering archetypes.

export const CHAMPIONS_SOURCE = 'Bungie dev insight 2026-05-29';

export type ChampionType = 'Barrier' | 'Unstoppable' | 'Overload';

/** Frame name (as the manifest spells it) to the champion type it stuns. */
export const FRAME_STUNS: ReadonlyMap<string, ChampionType> = new Map([
  ['Aggressive Frame', 'Unstoppable'],
  ['High-Impact Frame', 'Unstoppable'],
  ['Precision Frame', 'Barrier'],
  ['Adaptive Frame', 'Barrier'],
  ['Lightweight Frame', 'Overload'],
  ['Rapid-Fire Frame', 'Overload']
]);

export interface ChampionNote {
  /** e.g. 'Stuns Unstoppable (Aggressive Frame)' or the honest unknown. */
  label: string;
  stuns: ChampionType | null;
}

/** What a weapon with this intrinsic frame does to champions. */
export function championNote(frameName: string | null): ChampionNote {
  if (!frameName) {
    return {
      label: 'Frame unknown, so its champion effect is unknown. Community testing pending.',
      stuns: null
    };
  }
  const stuns = FRAME_STUNS.get(frameName) ?? null;
  if (!stuns) {
    return {
      label:
        'Intrinsic frame "' +
        frameName +
        '": the dev insight maps only the six legendary frames, so this one\'s champion effect is community testing pending.',
      stuns: null
    };
  }
  return { label: 'Stuns ' + stuns + ' (' + frameName + ')', stuns };
}
