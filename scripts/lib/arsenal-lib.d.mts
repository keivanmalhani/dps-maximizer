// Hand-written declarations for arsenal-lib.mjs so the vitest suite can
// import the helpers under `tsc --noEmit` (allowJs is off in this repo).
// Keep in step with arsenal-lib.mjs; the tests exercise the real module.

export declare const ICON_PREFIX: string;
export declare const RANDOMIZED_PERKS_PLACEHOLDER: string;
export declare const UNCAPPED_THRESHOLD: number;
export declare const ARCHETYPES: string[];

export declare function toAscii(name: unknown): string | null;
export declare function asciiJsonCompact(value: unknown): string;
export declare function scanEntries(
  text: string,
  onEntry: (key: string, rawEntry: string) => void
): void;
export declare function shortenIcon(path: string | null | undefined): string;
export declare function classifyArchetype(
  typeName: string,
  ammoType: number,
  frameName: string | null,
  tierType: number
): string | null;

export interface VersionedDef {
  quality?: { versions?: Array<{ powerCapHash: number }> };
}
export declare function maxPowerCap(
  def: VersionedDef,
  capByHash: ReadonlyMap<number, number>
): number | null;
export declare function isSunset(
  def: VersionedDef,
  capByHash: ReadonlyMap<number, number>
): boolean;

export interface SocketEntryLike {
  singleInitialItemHash?: number;
  randomizedPlugSetHash?: number;
  reusablePlugSetHash?: number;
  reusablePlugItems?: Array<{ plugItemHash: number }>;
}
export declare function pickFrame(
  socketEntries: SocketEntryLike[] | undefined,
  plugCatByHash: ReadonlyMap<number, string>,
  nameByHash: ReadonlyMap<number, string>
): { frame: string | null; randomized: boolean };

export interface ArsenalColumn {
  i: number;
  kind: 'trait' | 'origin';
  perks: number[];
}
export declare function extractColumns(
  socketEntries: SocketEntryLike[] | undefined,
  plugCatByHash: ReadonlyMap<number, string>,
  nameByHash: ReadonlyMap<number, string>,
  plugsOfSet: (setHash: number) => number[] | null | undefined
): ArsenalColumn[];
