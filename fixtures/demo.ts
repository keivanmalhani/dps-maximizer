// The demo account. Meridian#0404 is an invented account: no such player
// exists and nobody owns this vault. It exists so the page is never empty
// and so the whole pipeline can be seen working before anybody signs in.
//
// It is deliberately shaped like a real GetProfile response and fed through
// the same parseProfile the live path uses, so the demo exercises the real
// code rather than a parallel pretend version. The inventory is a plausible
// mid-game vault: strong tier 2 and 3 coverage, a couple of Collections-only
// unlocks, and the tier 1 rocket conspicuously missing so the "next unlock"
// answer has something honest to say.

import {
  BAKED_ITEMS,
  CATALYST_HASHES,
  CIPHER_HASH,
  EMPTY_CATALYST_HASHES,
  PERK_HASHES,
  STAT_HASHES
} from '../src/data/items';
import type { ApiItem, ProfileResponse } from '../src/ownership';
import type { PlayerRef } from '../src/bungie';

export const DEMO_PLAYER: PlayerRef = {
  displayName: 'Meridian',
  displayNameCode: 404,
  membershipType: 3,
  membershipId: '4611686018467400000'
};

export const DEMO_FLAG_LINE =
  'Meridian#0404 is an invented account. No such player exists and nobody owns this vault.';

/** Owned as real instances, buildable right now. */
const INSTANCES: Array<{ id: string; instanceId: string; plugs?: number[] }> = [
  { id: 'apex-predator', instanceId: 'demo-apex-1' },
  { id: 'gjallarhorn', instanceId: 'demo-gjally-1' },
  { id: 'thunderlord', instanceId: 'demo-thunderlord-1' },
  { id: 'praedyths-revenge', instanceId: 'demo-praedyth-1' },
  { id: 'still-hunt', instanceId: 'demo-stillhunt-1' },
  {
    id: 'ergo-sum',
    instanceId: 'demo-ergo-1',
    plugs: [PERK_HASHES['The Perfect Fifth'][0]]
  },
  {
    id: 'izanagis-burden',
    instanceId: 'demo-izanagi-1',
    plugs: [CATALYST_HASHES['izanagis-burden'].hashes[0]]
  },
  {
    id: 'whisper-of-the-worm',
    instanceId: 'demo-whisper-1',
    plugs: [EMPTY_CATALYST_HASHES[0]]
  },
  {
    id: 'outbreak-perfected',
    instanceId: 'demo-outbreak-1',
    plugs: [CATALYST_HASHES['outbreak-perfected'].hashes[0]]
  },
  { id: 'witherhoard', instanceId: 'demo-witherhoard-1' },
  { id: 'one-thousand-voices', instanceId: 'demo-1kv-1' },
  { id: 'cloudstrike', instanceId: 'demo-cloudstrike-1' },
  { id: 'celestial-nighthawk', instanceId: 'demo-celestial-1' },
  { id: 'synthoceps', instanceId: 'demo-synthoceps-1' },
  { id: 'lunafaction-boots', instanceId: 'demo-luna-1' }
];

/** Unlocked in Collections only. Exotics can be pulled; the legendary cannot. */
const COLLECTIONS_ONLY: string[] = [
  'cuirass-of-the-falling-star',
  'tractor-cannon',
  'divinity',
  'edge-transit'
];

export const DEMO_CIPHERS = 3;

function stats(values: Partial<Record<keyof typeof STAT_HASHES, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, value] of Object.entries(values)) {
    out[String(STAT_HASHES[name as keyof typeof STAT_HASHES])] = value as number;
  }
  return out;
}

export function buildDemoProfile(): ProfileResponse {
  const vaultItems: ApiItem[] = INSTANCES.map((entry) => ({
    itemHash: BAKED_ITEMS[entry.id].primaryHash,
    itemInstanceId: entry.instanceId,
    quantity: 1
  }));
  vaultItems.push({ itemHash: CIPHER_HASH, quantity: DEMO_CIPHERS });

  const collectibles: Record<string, { state: number }> = {};
  for (const id of COLLECTIONS_ONLY) {
    for (const hash of BAKED_ITEMS[id].collectibleHashes) {
      collectibles[String(hash)] = { state: 0 };
    }
  }

  const sockets: Record<string, { sockets: Array<{ plugHash: number; isEnabled: boolean }> }> = {};
  for (const entry of INSTANCES) {
    sockets[entry.instanceId] = {
      sockets: (entry.plugs ?? []).map((plugHash) => ({ plugHash, isEnabled: true }))
    };
  }

  return {
    profileInventory: { data: { items: vaultItems } },
    characterInventories: { data: {} },
    characterEquipment: { data: {} },
    profileCollectibles: { data: { collectibles } },
    characters: {
      data: {
        'demo-titan': {
          characterId: 'demo-titan',
          classType: 0,
          light: 2043,
          stats: stats({ Weapons: 152, Super: 128, Grenade: 64, Melee: 47, Health: 121, Class: 58 })
        },
        'demo-hunter': {
          characterId: 'demo-hunter',
          classType: 1,
          light: 2038,
          stats: stats({ Weapons: 143, Super: 141, Grenade: 51, Melee: 62, Health: 109, Class: 74 })
        },
        'demo-warlock': {
          characterId: 'demo-warlock',
          classType: 2,
          light: 2051,
          stats: stats({ Weapons: 165, Super: 133, Grenade: 78, Melee: 22, Health: 98, Class: 84 })
        }
      }
    },
    itemComponents: { sockets: { data: sockets } }
  };
}
