// The profile parser: somebody else's JSON in, the honest ownership model
// out. Fixtures are shaped exactly like GetProfile slices.

import { describe, expect, it } from 'vitest';
import {
  BAKED_ITEMS,
  CATALYST_HASHES,
  CIPHER_HASH,
  EMPTY_CATALYST_HASHES,
  PERK_HASHES,
  STAT_HASHES
} from '../src/data/items';
import {
  catalystState,
  collectibleAcquired,
  parseProfile,
  readStats,
  rollState,
  type ProfileResponse
} from '../src/ownership';
import { player } from './helpers';

const HEZEN = BAKED_ITEMS['hezen-vengeance'];
const GJALLY = BAKED_ITEMS['gjallarhorn'];

describe('collectibleAcquired', () => {
  it('bit 1 set means NotAcquired', () => {
    expect(collectibleAcquired(1)).toBe(false);
    expect(collectibleAcquired(3)).toBe(false);
    expect(collectibleAcquired(65)).toBe(false);
  });

  it('bit 1 clear means unlocked, whatever else is set', () => {
    expect(collectibleAcquired(0)).toBe(true);
    expect(collectibleAcquired(2)).toBe(true);
    expect(collectibleAcquired(64)).toBe(true);
  });

  it('missing state is not ownership', () => {
    expect(collectibleAcquired(undefined)).toBe(false);
  });
});

describe('parseProfile ownership', () => {
  it('sees the vault', () => {
    const data = parseProfile({
      profileInventory: { data: { items: [{ itemHash: HEZEN.primaryHash, itemInstanceId: 'a' }] } }
    });
    expect(data.owned['hezen-vengeance'].state).toBe('instances');
    expect(data.owned['hezen-vengeance'].instanceIds).toEqual(['a']);
  });

  it('sees character inventories', () => {
    const data = parseProfile({
      characterInventories: {
        data: { c1: { items: [{ itemHash: GJALLY.primaryHash, itemInstanceId: 'g' }] } }
      }
    });
    expect(data.owned['gjallarhorn'].state).toBe('instances');
  });

  it('sees equipped items', () => {
    const data = parseProfile({
      characterEquipment: {
        data: { c1: { items: [{ itemHash: BAKED_ITEMS['celestial-nighthawk'].primaryHash, itemInstanceId: 'h' }] } }
      }
    });
    expect(data.owned['celestial-nighthawk'].state).toBe('instances');
  });

  it('counts any manifest version of an item as the item', () => {
    const reissue = BAKED_ITEMS['edge-transit'].hashes[0];
    const data = parseProfile({
      profileInventory: { data: { items: [{ itemHash: reissue, itemInstanceId: 'e' }] } }
    });
    expect(data.owned['edge-transit'].state).toBe('instances');
  });

  it('reads collections into the weaker ownership state', () => {
    const collectible = BAKED_ITEMS['tractor-cannon'].collectibleHashes[0];
    const data = parseProfile({
      profileCollectibles: { data: { collectibles: { [String(collectible)]: { state: 0 } } } }
    });
    expect(data.owned['tractor-cannon'].state).toBe('collections');
  });

  it('reads character-level collectibles too', () => {
    const collectible = BAKED_ITEMS['cuirass-of-the-falling-star'].collectibleHashes[0];
    const data = parseProfile({
      characterCollectibles: {
        data: { c1: { collectibles: { [String(collectible)]: { state: 64 } } } }
      }
    });
    expect(data.owned['cuirass-of-the-falling-star'].state).toBe('collections');
  });

  it('never downgrades a real copy to a Collections entry', () => {
    const collectible = BAKED_ITEMS['gjallarhorn'].collectibleHashes[0];
    const data = parseProfile({
      profileInventory: { data: { items: [{ itemHash: GJALLY.primaryHash, itemInstanceId: 'g' }] } },
      profileCollectibles: { data: { collectibles: { [String(collectible)]: { state: 0 } } } }
    });
    expect(data.owned['gjallarhorn'].state).toBe('instances');
  });

  it('a NotAcquired collectible stays unowned', () => {
    const collectible = BAKED_ITEMS['divinity'].collectibleHashes[0];
    const data = parseProfile({
      profileCollectibles: { data: { collectibles: { [String(collectible)]: { state: 1 } } } }
    });
    expect(data.owned['divinity'].state).toBe('none');
  });

  it('ignores hashes it did not curate', () => {
    const data = parseProfile({
      profileInventory: { data: { items: [{ itemHash: 12345, itemInstanceId: 'x' }] } }
    });
    for (const entry of Object.values(data.owned)) expect(entry.state).toBe('none');
  });
});

describe('parseProfile ciphers', () => {
  it('counts Exotic Ciphers across stacks', () => {
    const data = parseProfile({
      profileInventory: {
        data: {
          items: [
            { itemHash: CIPHER_HASH, quantity: 2 },
            { itemHash: CIPHER_HASH, quantity: 1 }
          ]
        }
      }
    });
    expect(data.ciphers).toBe(3);
  });

  it('zero ciphers is zero, not unknown, when the inventory was readable', () => {
    const data = parseProfile({ profileInventory: { data: { items: [] } } });
    expect(data.ciphers).toBe(0);
  });

  it('an unreadable inventory reports null rather than a fake zero', () => {
    const data = parseProfile({});
    expect(data.ciphers).toBeNull();
  });
});

describe('parseProfile characters and sockets', () => {
  const response: ProfileResponse = {
    characters: {
      data: {
        c1: {
          characterId: 'c1',
          classType: 2,
          light: 2044,
          stats: { [String(STAT_HASHES.Weapons)]: 151, [String(STAT_HASHES.Super)]: 122 }
        },
        c2: { characterId: 'c2', classType: 0, light: 2001 }
      }
    },
    itemComponents: { sockets: { data: { inst1: { sockets: [{ plugHash: 111 }, { plugHash: 0 }, {}] } } } }
  };

  it('reads class, light and Armor 3.0 stats by the profile-keyed hashes', () => {
    const data = parseProfile(response);
    const warlock = data.characters.find((c) => c.classType === 2)!;
    expect(warlock.light).toBe(2044);
    expect(warlock.stats.Weapons).toBe(151);
    expect(warlock.stats.Super).toBe(122);
    expect(warlock.stats.Melee).toBeUndefined();
  });

  it('keeps socket plugs and drops empty slots', () => {
    const data = parseProfile(response);
    expect(data.socketsAvailable).toBe(true);
    expect(data.socketsByInstance['inst1']).toEqual([111]);
  });

  it('says when sockets were not in the response at all', () => {
    const data = parseProfile({});
    expect(data.socketsAvailable).toBe(false);
  });

  it('readStats tolerates a missing stats block', () => {
    expect(readStats(undefined)).toEqual({});
  });
});

describe('rollState', () => {
  const bait = PERK_HASHES['Bait and Switch'][0];
  const baitEnhanced = PERK_HASHES['Bait and Switch'][1];
  const overflow = PERK_HASHES['Overflow'][0];
  const envious = PERK_HASHES['Envious Assassin'][0];
  const cluster = PERK_HASHES['Cluster Bomb'][0];

  it('not-checked when the item has no wanted roll', () => {
    const data = player([{ id: 'apex-predator' }]);
    expect(rollState('apex-predator', data)).toBe('not-checked');
  });

  it('not-checked when nothing is owned to check', () => {
    const data = player([]);
    expect(rollState('hezen-vengeance', data)).toBe('not-checked');
  });

  it('has-roll when one instance satisfies every column', () => {
    const data = player([
      { id: 'hezen-vengeance', instanceIds: ['h1'], plugs: { h1: [overflow, bait] } }
    ]);
    expect(rollState('hezen-vengeance', data)).toBe('has-roll');
  });

  it('accepts either perk in a column', () => {
    const data = player([
      { id: 'hezen-vengeance', instanceIds: ['h1'], plugs: { h1: [envious, cluster] } }
    ]);
    expect(rollState('hezen-vengeance', data)).toBe('has-roll');
  });

  it('accepts the enhanced version of a perk', () => {
    const data = player([
      { id: 'hezen-vengeance', instanceIds: ['h1'], plugs: { h1: [overflow, baitEnhanced] } }
    ]);
    expect(rollState('hezen-vengeance', data)).toBe('has-roll');
  });

  it('missing-roll when a column goes unmatched', () => {
    const data = player([
      { id: 'hezen-vengeance', instanceIds: ['h1'], plugs: { h1: [overflow] } }
    ]);
    expect(rollState('hezen-vengeance', data)).toBe('missing-roll');
  });

  it('one good copy among several is enough', () => {
    const data = player([
      {
        id: 'hezen-vengeance',
        instanceIds: ['h1', 'h2'],
        plugs: { h1: [overflow], h2: [envious, bait] }
      }
    ]);
    expect(rollState('hezen-vengeance', data)).toBe('has-roll');
  });

  it('unknown when the profile exposed no sockets component', () => {
    const data = player([{ id: 'hezen-vengeance', instanceIds: ['h1'] }], {
      socketsAvailable: false
    });
    expect(rollState('hezen-vengeance', data)).toBe('unknown');
  });

  it('unknown when the instances have no socket rows', () => {
    const data = player([{ id: 'hezen-vengeance', instanceIds: ['h1'] }]);
    expect(rollState('hezen-vengeance', data)).toBe('unknown');
  });
});

describe('catalystState', () => {
  const izanagiCatalyst = CATALYST_HASHES['izanagis-burden'].hashes[0];
  const empty = EMPTY_CATALYST_HASHES[0];

  it('slotted when the catalyst plug is in the gun', () => {
    const data = player([
      { id: 'izanagis-burden', instanceIds: ['i1'], plugs: { i1: [izanagiCatalyst] } }
    ]);
    expect(catalystState('izanagis-burden', data)).toBe('slotted');
  });

  it('not-slotted when the socket is the empty catalyst plug', () => {
    const data = player([
      { id: 'izanagis-burden', instanceIds: ['i1'], plugs: { i1: [empty] } }
    ]);
    expect(catalystState('izanagis-burden', data)).toBe('not-slotted');
  });

  it('unknown when sockets say nothing either way', () => {
    const data = player([
      { id: 'izanagis-burden', instanceIds: ['i1'], plugs: { i1: [123] } }
    ]);
    expect(catalystState('izanagis-burden', data)).toBe('unknown');
  });

  it('unknown for a Collections-only copy, honestly', () => {
    const data = player([{ id: 'izanagis-burden', state: 'collections' }]);
    expect(catalystState('izanagis-burden', data)).toBe('unknown');
  });

  it('unknown when the profile exposed no sockets', () => {
    const data = player([{ id: 'izanagis-burden', instanceIds: ['i1'] }], {
      socketsAvailable: false
    });
    expect(catalystState('izanagis-burden', data)).toBe('unknown');
  });

  it('unknown for weapons whose catalyst this site does not track', () => {
    const data = player([{ id: 'gjallarhorn', instanceIds: ['g1'], plugs: { g1: [empty] } }]);
    expect(catalystState('gjallarhorn', data)).toBe('unknown');
  });
});
