// @vitest-environment jsdom
//
// The controller, in a real DOM, with the network stubbed.
//
// The first test in this file is the one the whole write design exists for:
// drawing the armoury must not send a single request. Rule three in
// write.ts says no write ever fires as a side effect of rendering, and a
// rule like that is only worth writing down if something fails when it is
// broken. Everything after it checks that the arming switch is a real gate
// rather than a decoration.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/auth', async () => {
  const actual = await vi.importActual<typeof import('../src/auth')>('../src/auth');
  return { ...actual, getSession: () => session };
});

import { __setArmoryForTests, type ArmoryData, type ProfileWithInventory } from '../src/armory';
import { ArmoryPanel, DOUBLE_CLICK_MS } from '../src/ui/armory-panel';

let session: { accessToken: string; expiresAt: number; membershipId: string } | null = null;

const KINETIC = 1498876634;
const VAULT = 138197802;

const data: ArmoryData = {
  manifestVersion: 'test',
  generated: '2026-08-08',
  meta: { iconPrefix: '/icons/', itemFields: [] },
  buckets: {},
  damage: {},
  stats: {},
  tiers: {},
  items: {
    '1001': ['Sunshot', 'sun.png', KINETIC, 6, 3, 9, 3, 3, 'Hand Cannon', 1, 0],
    '1002': ['Spare Auto', 'auto.png', KINETIC, 5, 3, 6, 3, 1, 'Auto Rifle', 1, 0]
  }
};

const profile: ProfileWithInventory = {
  characters: { data: { 'c-1': { characterId: 'c-1', classType: 0, light: 2010 } } },
  characterEquipment: {
    data: { 'c-1': { items: [{ itemHash: 1001, itemInstanceId: 'i-sun', bucketHash: KINETIC }] } }
  },
  characterInventories: {
    data: { 'c-1': { items: [{ itemHash: 1002, itemInstanceId: 'i-spare', bucketHash: KINETIC }] } }
  },
  profileInventory: { data: { items: [{ itemHash: 1002, itemInstanceId: 'i-vault', bucketHash: VAULT }] } }
};

let posts: Array<{ url: string; body: unknown }> = [];

function stubFetch(body: unknown = { ErrorCode: 1 }): void {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    posts.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  });
}

function memoryStore(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0
  } as unknown as Storage;
}

function makePanel(): { panel: ArmoryPanel; root: HTMLElement; refreshes: number } {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const state = { refreshes: 0 };
  const panel = new ArmoryPanel({
    root,
    account: { membershipType: 3, membershipId: 'm-1' },
    refresh: async () => {
      state.refreshes += 1;
      return profile;
    },
    storage: memoryStore(),
    now: () => '2026-08-08'
  });
  return { panel, root, get refreshes() { return state.refreshes; } } as never;
}

/** Two clicks inside the double click window, on the same tile. */
function doubleClick(tile: HTMLElement): void {
  tile.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  tile.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  posts = [];
  document.body.innerHTML = '';
  session = { accessToken: 'token', expiresAt: Date.now() + 3_600_000, membershipId: 'm-1' };
  __setArmoryForTests(data, { manifestVersion: 'test', plugs: {} });
  stubFetch();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  __setArmoryForTests(null, null);
});

describe('rendering', () => {
  it('sends nothing at all while drawing the grid', async () => {
    const { panel, root } = makePanel();
    await panel.open(profile);
    await settle();
    expect(root.querySelectorAll('.tile').length).toBeGreaterThan(0);
    expect(posts).toEqual([]);
  });

  it('opens the detail panel on a single click, still sending nothing', async () => {
    const { panel, root } = makePanel();
    await panel.open(profile);
    const tile = root.querySelector<HTMLElement>('[data-instance="i-spare"]')!;
    tile.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(root.querySelector('#detail')).not.toBeNull();
    expect(posts).toEqual([]);
  });
});

describe('the arming switch', () => {
  it('refuses a double click equip while it is off', async () => {
    const { panel, root } = makePanel();
    await panel.open(profile);
    doubleClick(root.querySelector<HTMLElement>('[data-instance="i-spare"]')!);
    await settle();
    expect(posts).toEqual([]);
    expect(root.querySelector('#armoury-status')?.textContent).toMatch(/Live changes are off/);
  });

  it('asks before arming, and stays off when the answer is no', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { panel, root } = makePanel();
    await panel.open(profile);
    const box = root.querySelector<HTMLInputElement>('#armoury-live')!;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(box.checked).toBe(false);
    doubleClick(root.querySelector<HTMLElement>('[data-instance="i-spare"]')!);
    await settle();
    expect(posts).toEqual([]);
  });

  it('equips on a double click once it is armed', async () => {
    const { panel, root } = makePanel();
    await panel.open(profile);
    const box = root.querySelector<HTMLInputElement>('#armoury-live')!;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    doubleClick(root.querySelector<HTMLElement>('[data-instance="i-spare"]')!);
    await settle();
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toContain('/Destiny2/Actions/Items/EquipItem/');
    expect(posts[0].body).toEqual({ itemId: 'i-spare', characterId: 'c-1', membershipType: 3 });
  });

  it('does not equip on two clicks that are far apart in time', async () => {
    const { panel, root } = makePanel();
    await panel.open(profile);
    const box = root.querySelector<HTMLInputElement>('#armoury-live')!;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    const tile = () => root.querySelector<HTMLElement>('[data-instance="i-spare"]')!;
    tile().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    // A synthetic MouseEvent carries timeStamp 0, so the window is driven
    // here by clicking a DIFFERENT tile in between, which is the same reset
    // a real user's stray click performs.
    root.querySelector<HTMLElement>('[data-instance="i-vault"]')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    await settle();
    tile().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(posts).toEqual([]);
    expect(DOUBLE_CLICK_MS).toBeGreaterThan(0);
  });

  it('will not even arm without an account, and says why', async () => {
    // Found in a browser, not by a test: on the demo the switch flipped and
    // the status line announced live changes were on, while every write was
    // still refused downstream. The switch has to refuse, not the write.
    const { panel, root } = makePanel();
    panel.setAccount(null);
    await panel.open(profile);
    const box = root.querySelector<HTMLInputElement>('#armoury-live')!;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(box.checked).toBe(false);
    expect(root.querySelector('#armoury-status')?.textContent).toMatch(/demo vault/);
  });

  it('sends nothing when the account is gone, however armed it is', async () => {
    const { panel, root } = makePanel();
    panel.setAccount(null);
    await panel.open(profile);
    const box = root.querySelector<HTMLInputElement>('#armoury-live')!;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    doubleClick(root.querySelector<HTMLElement>('[data-instance="i-spare"]')!);
    await settle();
    expect(posts).toEqual([]);
  });
});

describe('a vaulted item on a double click', () => {
  it('opens the panel and explains the move instead of guessing a character', async () => {
    const { panel, root } = makePanel();
    await panel.open(profile);
    const box = root.querySelector<HTMLInputElement>('#armoury-live')!;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    doubleClick(root.querySelector<HTMLElement>('[data-instance="i-vault"]')!);
    await settle();
    expect(posts).toEqual([]);
    expect(root.querySelector('#armoury-status')?.textContent).toMatch(/in the vault/);
    expect(root.querySelector('#detail')).not.toBeNull();
  });
});

describe('loadouts', () => {
  it('saves what a character is wearing without sending anything', async () => {
    const { panel, root } = makePanel();
    await panel.open(profile);
    root.querySelector<HTMLElement>('[data-snapshot="c-1"]')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    await settle();
    expect(posts).toEqual([]);
    expect(root.textContent).toContain('Titan as of 2026-08-08');
  });

  it('shows the plan before it moves anything, and cancelling sends nothing', async () => {
    const { panel, root } = makePanel();
    await panel.open(profile);
    const box = root.querySelector<HTMLInputElement>('#armoury-live')!;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    root.querySelector<HTMLElement>('[data-snapshot="c-1"]')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    await settle();
    root.querySelector<HTMLElement>('[data-apply]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(root.querySelector('#plan')).not.toBeNull();
    expect(posts).toEqual([]);
    root.querySelector<HTMLElement>('[data-plancancel]')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    await settle();
    expect(posts).toEqual([]);
    expect(root.querySelector('#armoury-status')?.textContent).toMatch(/Nothing was changed/);
  });
});
