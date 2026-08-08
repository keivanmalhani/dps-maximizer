// The armoury's markup. Pure functions, so this needs no browser.
//
// The thing worth guarding is that the grid keeps its shape: one row per
// slot, one column per character plus the vault, and every tile carrying the
// instance id the controller dispatches on. A grid that renders beautifully
// with no data-instance attributes is a grid where nothing is clickable and
// every screenshot still looks right.

import { describe, expect, it } from 'vitest';
import { buildArmory, type ArmoryData, type ProfileWithInventory } from '../src/armory';
import { armoryPage, bar, detail, grid, planDialog, tile, CELL_PREVIEW } from '../src/ui/armory-view';
import { planApply, type Loadout } from '../src/loadouts';
import type { ArmoryViewModel } from '../src/ui/armory-view';

const KINETIC = 1498876634;
const HELMET = 3448274439;
const VAULT = 138197802;

const data: ArmoryData = {
  manifestVersion: 'test',
  generated: '2026-08-08',
  meta: { iconPrefix: '/icons/', itemFields: [] },
  buckets: {},
  damage: {},
  stats: { '2996146975': 'Weapons' },
  tiers: {},
  items: {
    '1001': ['Sunshot', 'sun.png', KINETIC, 6, 3, 9, 3, 3, 'Hand Cannon', 1, 0],
    '1002': ['Spare Auto', 'auto.png', KINETIC, 5, 3, 6, 3, 1, 'Auto Rifle', 1, 0],
    '2001': ['Titan Helm', 'helm.png', HELMET, 5, 2, 26, 0, 0, 'Helmet', 0, 0]
  }
};

function profile(vaultCount = 3): ProfileWithInventory {
  const vault = [];
  for (let index = 0; index < vaultCount; index++) {
    vault.push({ itemHash: 1002, itemInstanceId: 'v-' + index, bucketHash: VAULT });
  }
  return {
    characters: { data: { 'c-1': { characterId: 'c-1', classType: 0, light: 2010 } } },
    characterEquipment: {
      data: { 'c-1': { items: [{ itemHash: 1001, itemInstanceId: 'i-sun', bucketHash: KINETIC, state: 1 }] } }
    },
    characterInventories: {
      data: { 'c-1': { items: [{ itemHash: 2001, itemInstanceId: 'i-helm', bucketHash: HELMET }] } }
    },
    profileInventory: { data: { items: vault } },
    itemComponents: {
      instances: { data: { 'i-sun': { primaryStat: { value: 2010 } } } },
      stats: { data: { 'i-helm': { stats: { '2996146975': { value: 62 } } } } },
      sockets: { data: { 'i-sun': { sockets: [{ plugHash: 500 }] } } }
    }
  };
}

function model(overrides: Partial<ArmoryViewModel> = {}, vaultCount = 3): ArmoryViewModel {
  return {
    armory: buildArmory(profile(vaultCount), data),
    data,
    query: '',
    selected: null,
    liveChanges: false,
    loadouts: [],
    status: '',
    expandedBucket: null,
    ...overrides
  };
}

describe('tile', () => {
  it('carries the instance id, an accessible name and the badges', () => {
    const armory = buildArmory(profile(), data);
    const html = tile(armory.byInstance.get('i-sun')!, data, false);
    expect(html).toContain('data-instance="i-sun"');
    expect(html).toContain('aria-label="Sunshot, Hand Cannon, power 2010, equipped"');
    expect(html).toContain('tile--exotic');
    expect(html).toContain('title="Locked"');
    expect(html).toContain('https://www.bungie.net/icons/sun.png');
  });

  it('marks the selected tile so a keyboard user can see where they are', () => {
    const armory = buildArmory(profile(), data);
    expect(tile(armory.byInstance.get('i-sun')!, data, true)).toContain('tile--selected');
    expect(tile(armory.byInstance.get('i-sun')!, data, false)).not.toContain('tile--selected');
  });
});

describe('grid', () => {
  it('draws every equipment slot and one column per character plus the vault', () => {
    const html = grid(model());
    expect(html).toContain('--cols:2');
    for (const label of ['Kinetic', 'Energy', 'Power', 'Helmet', 'Gauntlets', 'Chest', 'Legs', 'Class']) {
      expect(html, label).toContain('>' + label + '</div>');
    }
    expect(html).toContain('Weapons</div>');
    expect(html).toContain('Armour</div>');
  });

  it('puts the equipped item in its own row above the rest', () => {
    const html = grid(model());
    const equippedAt = html.indexOf('cell__equipped');
    const gridAt = html.indexOf('cell__grid');
    expect(equippedAt).toBeGreaterThan(-1);
    expect(equippedAt).toBeLessThan(gridAt);
  });

  it('caps a vault cell and offers the rest rather than drawing a thousand tiles', () => {
    const html = grid(model({}, CELL_PREVIEW + 4));
    expect(html).toContain('+4 more');
    expect(html).toContain('data-expand="' + KINETIC + '"');
  });

  it('shows everything once the cell is expanded', () => {
    const html = grid(model({ expandedBucket: KINETIC }, CELL_PREVIEW + 4));
    expect(html).not.toContain('more</button>');
    expect(html).toContain('show less');
  });

  it('filters on free text and on is: flags', () => {
    expect(grid(model({ query: 'sunshot' }))).not.toContain('data-instance="i-helm"');
    expect(grid(model({ query: 'sunshot' }))).toContain('data-instance="i-sun"');
    expect(grid(model({ query: 'is:vault' }))).not.toContain('data-instance="i-sun"');
    expect(grid(model({ query: 'is:exotic' }))).toContain('data-instance="i-sun"');
  });

  it('says a cell is empty rather than leaving a hole', () => {
    expect(grid(model({ query: 'nothing matches this' }))).toContain('nothing here');
  });
});

describe('bar', () => {
  it('counts what was actually read', () => {
    expect(bar(model())).toContain('5 items read');
  });

  it('names an unknown filter instead of silently ignoring it', () => {
    const html = bar(model({ query: 'is:sparkly' }));
    expect(html).toContain('No filter called is:sparkly');
    expect(html).toContain('is:masterwork');
  });

  it('reflects the live changes switch', () => {
    expect(bar(model({ liveChanges: true }))).toContain('id="armoury-live" checked');
    expect(bar(model({ liveChanges: false }))).not.toContain('checked');
  });
});

describe('detail', () => {
  it('offers no actions at all while live changes are off', () => {
    const armory = buildArmory(profile(), data);
    const html = detail(armory.byInstance.get('i-helm')!, model(), null, armory.characters);
    expect(html).toContain('Changes are switched off');
    expect(html).not.toContain('data-equipon');
    expect(html).not.toContain('data-tovault');
  });

  it('offers equip, vault and lock once armed', () => {
    const armory = buildArmory(profile(), data);
    const html = detail(
      armory.byInstance.get('i-helm')!,
      model({ liveChanges: true }),
      null,
      armory.characters
    );
    expect(html).toContain('data-equipon="c-1"');
    expect(html).toContain('data-tovault="i-helm"');
    expect(html).toContain('data-lock="i-helm"');
  });

  it('does not offer to equip the thing already equipped', () => {
    const armory = buildArmory(profile(), data);
    const html = detail(
      armory.byInstance.get('i-sun')!,
      model({ liveChanges: true }),
      null,
      armory.characters
    );
    expect(html).not.toContain('data-equipon');
  });

  it('says the perk table is still loading rather than printing hashes', () => {
    const armory = buildArmory(profile(), data);
    const html = detail(armory.byInstance.get('i-sun')!, model(), null, armory.characters);
    expect(html).toContain('Reading the perk table');
    expect(html).not.toContain('500');
  });

  it('names perks once the table is there', () => {
    const armory = buildArmory(profile(), data);
    const html = detail(armory.byInstance.get('i-sun')!, model(), {
      manifestVersion: 'test',
      plugs: { '500': ['Firefly', 'ff.png', 'Precision kills cause an explosion.', 'frames'] }
    }, armory.characters);
    expect(html).toContain('Firefly');
    expect(html).toContain('Precision kills cause an explosion.');
  });

  it('draws the instance stats it was given', () => {
    const armory = buildArmory(profile(), data);
    const html = detail(armory.byInstance.get('i-helm')!, model(), null, armory.characters);
    expect(html).toContain('Weapons');
    expect(html).toContain('>62<');
  });
});

describe('planDialog', () => {
  const loadout: Loadout = {
    id: 'l-1',
    name: 'Boss DPS',
    classType: 0,
    saved: '2026-08-08',
    items: [
      { instanceId: 'v-0', hash: 1002, bucket: KINETIC, name: 'Spare Auto' },
      { instanceId: 'gone', hash: 1002, bucket: KINETIC, name: 'Dismantled Gun' }
    ]
  };

  it('prints every step in order and every blocker with its fix', () => {
    const plan = planApply(loadout, buildArmory(profile(), data), 'c-1');
    const html = planDialog(plan, loadout.name);
    expect(html).toContain('Pull Spare Auto out of the vault');
    expect(html).toContain('Equip Spare Auto in the Kinetic slot');
    expect(html).toContain('Dismantled Gun');
    expect(html).toContain('data-planrun="1"');
    expect(html).toContain('data-plancancel="1"');
  });

  it('offers no run button when there is nothing it can do', () => {
    const plan = planApply({ ...loadout, items: [loadout.items[1]] }, buildArmory(profile(), data), 'c-1');
    const html = planDialog(plan, loadout.name);
    expect(html).not.toContain('data-planrun');
    expect(html).toContain('data-plancancel');
  });
});

describe('armoryPage', () => {
  it('escapes anything a manifest name could smuggle in', () => {
    const nasty: ArmoryData = {
      ...data,
      items: { '1001': ['<img src=x onerror=alert(1)>', '', KINETIC, 6, 3, 9, 3, 3, 'Hand Cannon', 1, 0] }
    };
    const html = armoryPage({ ...model(), data: nasty, armory: buildArmory(profile(), nasty) });
    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;img src=x onerror');
  });

  it('has the loadout empty state, the grid and the overlay mount', () => {
    const html = armoryPage(model());
    expect(html).toContain('No saved loadouts yet');
    expect(html).toContain('armoury__grid');
    expect(html).toContain('id="armoury-overlay"');
    expect(html).toContain('data-snapshot="c-1"');
  });
});
