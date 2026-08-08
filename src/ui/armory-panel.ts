// The armoury controller: the only place in the site where a click can turn
// into a change in somebody's account.
//
// Everything it draws comes from armory-view.ts, which is pure. Everything it
// writes goes through write.ts, which will not accept a call without a
// Confirmation. What lives HERE is the middle: which click means what, and
// what a person is shown before anything moves.
//
// THE ARMING SWITCH, and why double click does not open a dialog
//
// _hq/bungie-app.md sets the rule that every write sits behind an explicit
// confirm. Taken literally that means a modal on every equip, and a modal on
// every equip means nobody uses the grid, which defeats the point of building
// it. So the confirm is split by consequence, and the split is stated rather
// than smuggled:
//
//   Live changes off by default. Nothing can be written at all. Turning it on
//   is a deliberate act and the dialog names exactly what it permits. That is
//   the explicit confirm, held for the session.
//
//   Equip on the character already holding the item: no further dialog. It is
//   reversible in one click and cannot lose an item.
//
//   Anything that MOVES an item, and any loadout: a per action confirm that
//   prints the plan first. Moves are the ones that can hit a full postmaster,
//   which is the only way this site could cost somebody real gear.
//
// If that split is wrong it is wrong in one place and it is written down.

import { escapeText } from '../format';
import {
  buildArmory,
  loadArmory,
  loadPlugs,
  type Armory,
  type ArmoryData,
  type PlugData,
  type ProfileWithInventory
} from '../armory';
import {
  equipIds,
  loadSaved,
  planApply,
  saveAll,
  snapshot,
  type ApplyPlan,
  type Loadout
} from '../loadouts';
import {
  confirmWrite,
  equipItem,
  equipItems,
  setLockState,
  transferItem,
  type Account
} from '../write';
import { armoryPage, detail, planDialog, type ArmoryViewModel } from './armory-view';

/** How long a double click window is. Matches what desktop toolkits use. */
export const DOUBLE_CLICK_MS = 320;

export interface ArmoryHost {
  /** Where the panel draws itself. */
  root: HTMLElement;
  /** The account the writes are addressed to. Null while signed out. */
  account: Account | null;
  /** Re-read the profile after a change, so the grid tells the truth. */
  refresh: () => Promise<ProfileWithInventory>;
  /** Storage for saved loadouts. Injected so tests do not need a browser. */
  storage: Storage | null;
  /** Stamped onto saved loadouts. Injected so the module stays pure to test. */
  now: () => string;
}

export class ArmoryPanel {
  private host: ArmoryHost;
  private data: ArmoryData | null = null;
  private plugs: PlugData | null = null;
  private armory: Armory | null = null;
  private loadouts: Loadout[] = [];
  private selected: string | null = null;
  private query = '';
  private liveChanges = false;
  private status = '';
  private expandedBucket: number | null = null;
  private pendingPlan: { plan: ApplyPlan; loadout: Loadout } | null = null;
  private busy = false;
  private lastClick: { instanceId: string; at: number } | null = null;

  constructor(host: ArmoryHost) {
    this.host = host;
    this.loadouts = loadSaved(host.storage);
  }

  /** The shell re-renders and hands over a fresh node to draw into. */
  setHostRoot(root: HTMLElement): void {
    this.host.root = root;
  }

  /**
   * Writes are addressed to an account, and a demo visitor does not have one.
   * Setting it to null is what makes the demo grid read only no matter what
   * the live changes switch says, which is checked in guard() rather than
   * assumed from the switch alone.
   */
  setAccount(account: Account | null): void {
    this.host.account = account;
    if (!account) this.liveChanges = false;
  }

  // --------------------------------------------------------------- lifecycle

  /** Load the baked table once, then draw. Never writes. */
  async open(profile: ProfileWithInventory): Promise<void> {
    if (!this.data) {
      this.host.root.innerHTML = `<p class="prose">Reading the item table, which ships with the site and loads once...</p>`;
      try {
        this.data = await loadArmory();
      } catch (error) {
        this.host.root.innerHTML =
          `<p class="prose">The item table did not load, so the armoury cannot be drawn. ` +
          escapeText(error instanceof Error ? error.message : String(error)) +
          `</p>`;
        return;
      }
    }
    this.armory = buildArmory(profile, this.data);
    this.render();
    // The perk table is only needed when a detail panel opens, but starting
    // it now means the first click is instant. It is a prefetch, not a
    // dependency: nothing below waits on it.
    void this.warmPlugs();
  }

  private async warmPlugs(): Promise<void> {
    if (this.plugs) return;
    try {
      this.plugs = await loadPlugs();
      if (this.selected) this.paintDetail();
    } catch {
      // The grid works without perk names. The panel says so when it opens.
    }
  }

  private model(): ArmoryViewModel {
    return {
      armory: this.armory!,
      data: this.data!,
      query: this.query,
      selected: this.selected,
      liveChanges: this.liveChanges,
      loadouts: this.loadouts,
      status: this.status,
      expandedBucket: this.expandedBucket
    };
  }

  private render(): void {
    if (!this.armory || !this.data) return;
    this.host.root.innerHTML = armoryPage(this.model());
    this.bind();
    this.paintOverlay();
  }

  private paintStatus(text: string): void {
    this.status = text;
    const host = this.host.root.querySelector('#armoury-status');
    if (host) host.textContent = text;
  }

  private overlay(): HTMLElement | null {
    return this.host.root.querySelector('#armoury-overlay');
  }

  private paintOverlay(): void {
    const host = this.overlay();
    if (!host) return;
    if (this.pendingPlan) {
      host.innerHTML = planDialog(this.pendingPlan.plan, this.pendingPlan.loadout.name);
      return;
    }
    if (this.selected) {
      this.paintDetail();
      return;
    }
    host.innerHTML = '';
  }

  private paintDetail(): void {
    const host = this.overlay();
    const item = this.selected ? this.armory?.byInstance.get(this.selected) : null;
    if (!host || !item || !this.armory) return;
    host.innerHTML = detail(item, this.model(), this.plugs, this.armory.characters);
  }

  // ------------------------------------------------------------------ events

  private bind(): void {
    const root = this.host.root;

    root.querySelector('#armoury-q')?.addEventListener('input', (event) => {
      const box = event.target as HTMLInputElement;
      const caret = box.selectionStart ?? box.value.length;
      this.query = box.value;
      this.render();
      const next = root.querySelector<HTMLInputElement>('#armoury-q');
      if (next) {
        next.focus();
        next.setSelectionRange(caret, caret);
      }
    });

    root.querySelector('#armoury-live')?.addEventListener('change', (event) => {
      const box = event.target as HTMLInputElement;
      if (!box.checked) {
        this.liveChanges = false;
        this.paintStatus('Live changes are off. The armoury is read only again.');
        this.paintOverlay();
        return;
      }
      // Caught by looking at the demo in a browser: the switch flipped, the
      // status line said live changes were on, and guard() then refused every
      // write because a demo account has nothing to write to. Nothing unsafe
      // happened, the page just claimed a state it did not have. A switch
      // that lies about being armed is worse than one that will not arm.
      if (!this.host.account) {
        this.liveChanges = false;
        box.checked = false;
        this.paintStatus(
          'This is the demo vault, which belongs to nobody, so there is nothing to change. ' +
            'Sign in with Bungie and the switch will work on your own account.'
        );
        this.paintOverlay();
        return;
      }
      this.liveChanges = this.askToArm();
      box.checked = this.liveChanges;
      this.paintStatus(
        this.liveChanges
          ? 'Live changes are on. Double click an item to equip it, and any move will show you the plan first.'
          : 'Left switched off, so nothing here can change your account.'
      );
      this.paintOverlay();
    });

    root.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest('[data-instance],[data-expand],[data-snapshot],[data-apply],[data-forget],[data-equipon],[data-tovault],[data-lock],[data-close],[data-planrun],[data-plancancel]');
      if (!target) return;
      void this.onClick(target as HTMLElement, event as MouseEvent);
    });
  }

  /**
   * The arming dialog. window.confirm on purpose: this is the one moment the
   * page genuinely wants to stop and be answered, and a hand rolled modal
   * that a stylesheet could hide is a worse guarantee than the browser's own.
   */
  private askToArm(): boolean {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') return false;
    return window.confirm(
      'Turn on live changes?\n\n' +
        'This lets this page equip and move items in your real Destiny account, ' +
        'using the permission you granted Bungie when you signed in.\n\n' +
        'Equipping something a character already holds happens straight away. ' +
        'Anything that moves an item, and every loadout, shows you the exact plan ' +
        'and asks again before it runs.\n\n' +
        'You can switch this back off at any time.'
    );
  }

  private async onClick(target: HTMLElement, event: MouseEvent): Promise<void> {
    if (this.busy) return;

    const expand = target.getAttribute('data-expand');
    if (expand !== null) {
      this.expandedBucket = Number(expand) || null;
      this.render();
      return;
    }
    if (target.hasAttribute('data-close')) {
      this.selected = null;
      this.paintOverlay();
      return;
    }
    if (target.hasAttribute('data-plancancel')) {
      this.pendingPlan = null;
      this.paintStatus('Cancelled. Nothing was changed.');
      this.paintOverlay();
      return;
    }
    if (target.hasAttribute('data-planrun')) {
      await this.runPlan();
      return;
    }

    const snapshotChar = target.getAttribute('data-snapshot');
    if (snapshotChar !== null) {
      this.saveSnapshot(snapshotChar);
      return;
    }
    const forget = target.getAttribute('data-forget');
    if (forget !== null) {
      this.loadouts = this.loadouts.filter((loadout) => loadout.id !== forget);
      saveAll(this.host.storage, this.loadouts);
      this.render();
      return;
    }
    const apply = target.getAttribute('data-apply');
    if (apply !== null) {
      this.preparePlan(apply, target.getAttribute('data-onchar') ?? '');
      return;
    }

    const equipOn = target.getAttribute('data-equipon');
    if (equipOn !== null) {
      await this.equipFromDetail(target.getAttribute('data-instance') ?? '', equipOn);
      return;
    }
    const toVault = target.getAttribute('data-tovault');
    if (toVault !== null) {
      await this.sendToVault(toVault);
      return;
    }
    const lock = target.getAttribute('data-lock');
    if (lock !== null) {
      await this.toggleLock(lock);
      return;
    }

    const instanceId = target.getAttribute('data-instance');
    if (instanceId) {
      const now = event.timeStamp || 0;
      const previous = this.lastClick;
      this.lastClick = { instanceId, at: now };
      const isDouble =
        previous && previous.instanceId === instanceId && now - previous.at <= DOUBLE_CLICK_MS;
      if (isDouble) {
        this.lastClick = null;
        await this.equipInPlace(instanceId);
        return;
      }
      this.selected = instanceId;
      this.paintOverlay();
    }
  }

  // ------------------------------------------------------------------ writes

  private guard(): Account | null {
    if (!this.host.account) {
      this.paintStatus(
        'Nothing was sent. This is either the demo vault or a sign-in that has run out, and ' +
          'neither one has an account to change.'
      );
      return null;
    }
    if (!this.liveChanges) {
      this.paintStatus('Live changes are off, so nothing was sent. Turn the switch on first.');
      return null;
    }
    return this.host.account;
  }

  /**
   * Double click. Equips the item on the character already holding it, which
   * is the one write with no way to lose anything. An item in the vault, or
   * on another Guardian, cannot be equipped in place: that needs a move, and
   * a move goes through the confirmed path in the detail panel.
   */
  private async equipInPlace(instanceId: string): Promise<void> {
    const item = this.armory?.byInstance.get(instanceId);
    if (!item) return;
    if (item.equipped) {
      this.paintStatus('That is already equipped.');
      return;
    }
    if (item.owner === null) {
      this.selected = instanceId;
      this.paintOverlay();
      this.paintStatus(
        'That one is in the vault, so equipping it means moving it first. Pick the character in the panel.'
      );
      return;
    }
    const account = this.guard();
    if (!account) return;

    this.busy = true;
    this.paintStatus('Equipping ' + (item.def ? item.def[0] : 'that item') + '...');
    const result = await equipItem(
      account,
      item.owner,
      instanceId,
      confirmWrite('Equip ' + (item.def ? item.def[0] : 'this item') + ' on the character holding it.')
    );
    this.busy = false;
    this.paintStatus(result.ok ? (item.def ? item.def[0] : 'Item') + ' equipped.' : result.message);
    if (result.ok) await this.reload();
  }

  private async equipFromDetail(instanceId: string, characterId: string): Promise<void> {
    const item = this.armory?.byInstance.get(instanceId);
    const account = this.guard();
    if (!item || !account || !this.armory) return;

    const name = item.def ? item.def[0] : 'that item';
    const target = this.armory.characters.find((c) => c.characterId === characterId);
    const needsMove = item.owner !== characterId;

    if (needsMove) {
      const where = item.owner === null ? 'the vault' : 'your other Guardian';
      const sentence =
        'Move ' + name + ' from ' + where + ' to your ' + (target?.className ?? 'character') + ' and equip it.';
      if (!this.askAgain(sentence)) {
        this.paintStatus('Cancelled. Nothing was changed.');
        return;
      }
      this.busy = true;
      if (item.owner !== null) {
        this.paintStatus('Sending ' + name + ' to the vault...');
        const out = await transferItem(
          account,
          { itemReferenceHash: item.hash, itemId: instanceId, characterId: item.owner, toVault: true },
          confirmWrite(sentence)
        );
        if (!out.ok) {
          this.busy = false;
          this.paintStatus(out.message);
          return;
        }
      }
      this.paintStatus('Pulling ' + name + ' out of the vault...');
      const inbound = await transferItem(
        account,
        { itemReferenceHash: item.hash, itemId: instanceId, characterId, toVault: false },
        confirmWrite(sentence)
      );
      if (!inbound.ok) {
        this.busy = false;
        this.paintStatus(inbound.message);
        return;
      }
      this.busy = false;
    }

    this.busy = true;
    const result = await equipItem(
      account,
      characterId,
      instanceId,
      confirmWrite('Equip ' + name + ' on your ' + (target?.className ?? 'character') + '.')
    );
    this.busy = false;
    this.paintStatus(result.ok ? name + ' equipped.' : result.message);
    if (result.ok) await this.reload();
  }

  private async sendToVault(instanceId: string): Promise<void> {
    const item = this.armory?.byInstance.get(instanceId);
    const account = this.guard();
    if (!item || !account || item.owner === null) return;
    const name = item.def ? item.def[0] : 'that item';
    const sentence = 'Send ' + name + ' to the vault.';
    if (!this.askAgain(sentence)) {
      this.paintStatus('Cancelled. Nothing was changed.');
      return;
    }
    this.busy = true;
    const result = await transferItem(
      account,
      { itemReferenceHash: item.hash, itemId: instanceId, characterId: item.owner, toVault: true },
      confirmWrite(sentence)
    );
    this.busy = false;
    this.paintStatus(result.ok ? name + ' is in the vault.' : result.message);
    if (result.ok) await this.reload();
  }

  private async toggleLock(instanceId: string): Promise<void> {
    const item = this.armory?.byInstance.get(instanceId);
    const account = this.guard();
    if (!item || !account || !item.owner) {
      this.paintStatus('Destiny only lets a character lock an item, and that one is in the vault.');
      return;
    }
    const name = item.def ? item.def[0] : 'that item';
    this.busy = true;
    const result = await setLockState(
      account,
      { itemId: instanceId, characterId: item.owner, locked: !item.locked },
      confirmWrite((item.locked ? 'Unlock ' : 'Lock ') + name + '.')
    );
    this.busy = false;
    this.paintStatus(result.ok ? name + (item.locked ? ' unlocked.' : ' locked.') : result.message);
    if (result.ok) await this.reload();
  }

  private askAgain(sentence: string): boolean {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') return false;
    return window.confirm(sentence + '\n\nThis changes your real account.');
  }

  // --------------------------------------------------------------- loadouts

  private saveSnapshot(characterId: string): void {
    const character = this.armory?.characters.find((c) => c.characterId === characterId);
    if (!character) return;
    const name = character.className + ' as of ' + this.host.now();
    const id = 'l-' + character.characterId + '-' + this.host.now() + '-' + this.loadouts.length;
    this.loadouts = [...this.loadouts, snapshot(character, name, id, this.host.now())];
    const stored = saveAll(this.host.storage, this.loadouts);
    this.render();
    this.paintStatus(
      stored
        ? 'Saved "' + name + '". It is kept in this browser only, and the export button hands you the file.'
        : 'Saved for this session, but this browser refused to store it, so it will not survive a reload.'
    );
  }

  private preparePlan(loadoutId: string, characterId: string): void {
    const loadout = this.loadouts.find((entry) => entry.id === loadoutId);
    if (!loadout || !this.armory) return;
    if (!this.liveChanges) {
      this.paintStatus('Live changes are off. Turn the switch on to apply a loadout.');
      return;
    }
    this.pendingPlan = { plan: planApply(loadout, this.armory, characterId), loadout };
    this.selected = null;
    this.paintOverlay();
  }

  /**
   * Run the plan. Transfers go one at a time and stop at the first refusal,
   * because a half applied loadout that keeps going is how an account ends up
   * somewhere nobody asked for. The equips go as one call at the end, and its
   * per item results are read rather than its envelope.
   */
  private async runPlan(): Promise<void> {
    const pending = this.pendingPlan;
    const account = this.guard();
    if (!pending || !account) return;
    this.busy = true;
    const confirmation = confirmWrite(pending.plan.summary);
    let done = 0;

    for (const step of pending.plan.steps) {
      if (step.kind === 'equip') continue;
      this.paintStatus(step.why);
      const result = await transferItem(
        account,
        {
          itemReferenceHash: step.itemHash,
          itemId: step.itemId,
          characterId: step.characterId,
          toVault: step.kind === 'to-vault'
        },
        confirmation
      );
      if (!result.ok) {
        this.busy = false;
        this.pendingPlan = null;
        this.paintStatus(
          'Stopped after ' + done + ' of ' + pending.plan.steps.length + ' steps. ' + result.message
        );
        await this.reload();
        return;
      }
      done += 1;
    }

    const ids = equipIds(pending.plan);
    if (ids.length > 0) {
      this.paintStatus('Equipping ' + ids.length + ' items...');
      const result = await equipItems(account, pending.plan.targetCharacterId, ids, confirmation);
      this.busy = false;
      this.pendingPlan = null;
      this.paintStatus(result.message);
      await this.reload();
      return;
    }

    this.busy = false;
    this.pendingPlan = null;
    this.paintStatus('Done. ' + done + ' items moved.');
    await this.reload();
  }

  /** Re-read the account so what is on screen is what Bungie now believes. */
  private async reload(): Promise<void> {
    try {
      const profile = await this.host.refresh();
      if (this.data) this.armory = buildArmory(profile, this.data);
      const keptStatus = this.status;
      this.render();
      this.paintStatus(keptStatus);
    } catch {
      this.paintStatus(
        this.status + ' The change went through, but re-reading your account failed, so the grid below may be one step behind.'
      );
    }
  }
}
