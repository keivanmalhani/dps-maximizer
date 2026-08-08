// Shared fixture builders for the suite. Not a test file.

import { BAKED_ITEMS } from '../src/data/items';
import type { GuardianClass, Owned, PlayerData } from '../src/types';

export interface OwnSpec {
  id: string;
  state?: Owned;
  instanceIds?: string[];
  plugs?: Record<string, number[]>;
}

/** A PlayerData with the named items owned and everything else absent. */
export function player(
  specs: Array<string | OwnSpec> = [],
  options: {
    classes?: GuardianClass[];
    ciphers?: number | null;
    socketsAvailable?: boolean;
  } = {}
): PlayerData {
  const owned: PlayerData['owned'] = {};
  for (const id of Object.keys(BAKED_ITEMS)) {
    owned[id] = { state: 'none', instanceIds: [], quantity: 0 };
  }
  const socketsByInstance: Record<string, number[]> = {};
  for (const raw of specs) {
    const spec: OwnSpec = typeof raw === 'string' ? { id: raw } : raw;
    if (!(spec.id in owned)) throw new Error('unknown curated id in fixture: ' + spec.id);
    const state = spec.state ?? 'instances';
    const instanceIds =
      spec.instanceIds ?? (state === 'instances' ? [spec.id + '-instance-1'] : []);
    owned[spec.id] = { state, instanceIds, quantity: instanceIds.length || 1 };
    for (const [instanceId, plugs] of Object.entries(spec.plugs ?? {})) {
      socketsByInstance[instanceId] = plugs;
    }
  }
  const classes = options.classes ?? [0, 1, 2];
  return {
    owned,
    socketsByInstance,
    socketsAvailable: options.socketsAvailable ?? true,
    characters: classes.map((classType, index) => ({
      characterId: 'char-' + index,
      classType,
      light: 2000 + index,
      stats: { Weapons: 120, Super: 100, Grenade: 60, Melee: 40, Health: 80, Class: 50 }
    })),
    ciphers: options.ciphers === undefined ? 0 : options.ciphers
  };
}

/** Everything curated, owned as instances. The kitchen-sink account. */
export function ownsEverything(): PlayerData {
  return player(Object.keys(BAKED_ITEMS).map((id) => ({ id })));
}
