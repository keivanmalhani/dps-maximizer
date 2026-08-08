// Application shell.
//
// There is no empty state. The page always has an answer on it: the demo
// vault on arrival, the visitor's own once they ask for it. The run bar sits
// above the answer the whole time, and an error never wipes what is already
// on screen.
//
// One way in, on purpose. This site reads the vault and Collections, which
// are authenticated components: a Bungie Name lookup could never see them,
// so offering one would be offering a worse answer that looks like the same
// answer. Signed out, the demo is the product tour.
//
// The run target is either a generic mode (the four sourced modes plus the
// PvP refusal) or a specific encounter out of src/data/encounters.ts. The
// target and class live in the URL query string, so any encounter loadout
// is a link somebody can share; a bad link falls back to the default demo
// answer rather than an empty page.

import {
  DEFAULT_ARSENAL_FILTERS,
  loadArsenal,
  ownedArsenal,
  rankArsenal,
  type ArsenalData,
  type ArsenalFilters
} from '../arsenal';
import { getSession, minutesLeft, signIn, signOut, signedIn } from '../auth';
import { formatBungieName, getProfile } from '../bungie';
import { buildDemoProfile, DEMO_FLAG_LINE, DEMO_PLAYER } from '../../fixtures/demo';
import { findEncounter, type Encounter, ACTIVITY_BY_ID, firstDamageEncounter } from '../data/encounters';
import { encounterMode, recommendEncounter, type EncounterVerdict } from '../encounter';
import { escapeText } from '../format';
import { parseProfile, type ProfileResponse } from '../ownership';
import { alternativeLoadouts, recommend, type Verdict } from '../recommend';
import { failureText, getOwnPlayer, isSessionExpiry, signInView } from '../signin';
import type { SignInView } from '../signin';
import type { Activity, GuardianClass, PlayerData } from '../types';
import { ACTIVITY_LABELS } from '../types';
import { parseUrlState, serializeUrlState, type RunTarget } from '../url-state';
import { arsenalTableHtml, resultPage, runbar, type PageModel } from './sections';

export interface AppState {
  source: 'demo' | 'live';
  playerName: string;
  flagLine: string;
  data: PlayerData;
  /** The raw response the data came from; the arsenal table reads it too. */
  profile: ProfileResponse;
  classType: GuardianClass;
  /** The last generic mode picked, kept so leaving an encounter restores it. */
  activity: Activity;
  target: RunTarget;
  arsenalFilters: ArsenalFilters;
}

export function defaultClass(data: PlayerData): GuardianClass {
  return data.characters[0]?.classType ?? 0;
}

export function availableClasses(data: PlayerData): GuardianClass[] {
  const seen: GuardianClass[] = [];
  for (const character of data.characters) {
    if (!seen.includes(character.classType)) seen.push(character.classType);
  }
  return seen.length > 0 ? seen : [0, 1, 2];
}

function el<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export class App {
  private root: HTMLElement;
  private state: AppState | null = null;
  private arsenal: ArsenalData | null = null;
  private arsenalLoading = false;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  start(): void {
    const url = parseUrlState(typeof location !== 'undefined' ? location.search : '');
    const profile = buildDemoProfile();
    const data = parseProfile(profile);
    const urlClass = url.classType;
    this.state = {
      source: 'demo',
      playerName: formatBungieName(DEMO_PLAYER),
      flagLine: DEMO_FLAG_LINE,
      data,
      profile,
      classType:
        urlClass !== null && availableClasses(data).includes(urlClass)
          ? urlClass
          : defaultClass(data),
      activity: url.target.kind === 'mode' ? url.target.activity : 'boss-burst',
      target: url.target,
      arsenalFilters: { ...DEFAULT_ARSENAL_FILTERS }
    };
    this.render();
    if (signedIn()) el<HTMLButtonElement>('mine')?.focus();
  }

  // ---------------------------------------------------------------- render

  private masthead(): string {
    return (
      `<div class="masthead"><div class="shell"><div class="masthead__inner">` +
      `<div class="wordmark">DPS <span>Maximizer</span></div>` +
      `<div class="masthead__meta">The answer, not another spreadsheet</div>` +
      `</div></div></div>`
    );
  }

  private account(): SignInView {
    return signInView(getSession(), minutesLeft());
  }

  private pageModel(state: AppState): PageModel {
    return {
      source: state.source,
      playerName: state.playerName,
      flagLine: state.flagLine,
      classType: state.classType,
      activity: state.activity,
      availableClasses: availableClasses(state.data),
      character: state.data.characters.find((c) => c.classType === state.classType) ?? null,
      target: state.target
    };
  }

  private currentEncounter(state: AppState): EncounterVerdict | null {
    if (state.target.kind !== 'encounter') return null;
    const hit = findEncounter(state.target.activityId, state.target.encounterId);
    if (!hit) return null;
    return recommendEncounter(state.data, state.classType, hit.activity, hit.encounter);
  }

  private render(): void {
    const state = this.state;
    if (!state) return;
    const model = this.pageModel(state);

    let html: string;
    let autoArsenal = false;
    const ev = this.currentEncounter(state);
    if (ev) {
      // ev.verdict is null only for no-DPS encounters, where resultPage
      // renders the honest empty state and never touches the verdict.
      const verdict = ev.verdict ?? recommend(state.data, state.classType, 'boss-burst');
      autoArsenal = ev.noDps === null;
      html = resultPage(model, verdict, this.account(), {
        encounter: ev,
        arsenalAuto: autoArsenal
      });
    } else {
      const activity = state.target.kind === 'mode' ? state.target.activity : 'boss-burst';
      const verdict: Verdict = recommend(state.data, state.classType, activity);
      const alternatives =
        activity === 'pvp' ? [] : alternativeLoadouts(activity, state.data);
      html = resultPage(model, verdict, this.account(), { alternatives });
    }

    this.root.innerHTML = this.masthead() + html;
    this.bind();
    this.syncUrl();
    if (autoArsenal) void this.ensureArsenal();
  }

  /** Keep the URL shareable: target and class, nothing else. */
  private syncUrl(): void {
    const state = this.state;
    if (!state || typeof history === 'undefined' || typeof location === 'undefined') return;
    try {
      history.replaceState(null, '', location.pathname + serializeUrlState(state.target, state.classType));
    } catch {
      // A file:// or sandboxed context that refuses replaceState is not an
      // error worth surfacing; the page still works, only the link is plain.
    }
  }

  /**
   * Redraw only the run bar, for when the session changed but the answer on
   * screen did not. Replacing the node drops its listeners with it, so they
   * are bound again rather than accumulating.
   */
  private paintAccount(): void {
    const state = this.state;
    const host = el<HTMLElement>('runbar');
    if (!state || !host) return;
    host.outerHTML = runbar(this.pageModel(state), this.account());
    this.bind();
  }

  private bind(): void {
    el<HTMLButtonElement>('signin')?.addEventListener('click', () => {
      try {
        signIn();
      } catch (error) {
        this.setNotice({
          title: 'Sign-in could not start',
          body: error instanceof Error ? error.message : String(error)
        });
      }
    });
    el<HTMLButtonElement>('signout')?.addEventListener('click', () => {
      signOut();
      this.paintAccount();
      this.setNotice({
        title: 'Signed out',
        body: 'The demo still works, and your own vault is one sign-in away.'
      });
    });
    el<HTMLButtonElement>('mine')?.addEventListener('click', () => {
      void this.runMine();
    });
    el<HTMLButtonElement>('demo')?.addEventListener('click', () => {
      this.start();
    });

    const picker = el<HTMLElement>('picker');
    picker?.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const classPick = target.getAttribute('data-class');
      const activityPick = target.getAttribute('data-activity');
      const encounterPick = target.getAttribute('data-encounter');
      const state = this.state;
      if (!state) return;
      if (classPick !== null) {
        state.classType = Number(classPick) as GuardianClass;
        this.render();
      } else if (activityPick !== null) {
        state.activity = activityPick as Activity;
        state.target = { kind: 'mode', activity: activityPick as Activity };
        this.render();
      } else if (encounterPick !== null && state.target.kind === 'encounter') {
        state.target = { kind: 'encounter', activityId: state.target.activityId, encounterId: encounterPick };
        this.render();
      }
    });
    el<HTMLSelectElement>('activity-select')?.addEventListener('change', (event) => {
      const state = this.state;
      if (!state) return;
      const value = (event.target as HTMLSelectElement).value;
      if (value === '') {
        state.target = { kind: 'mode', activity: state.activity };
      } else {
        const activity = ACTIVITY_BY_ID.get(value);
        if (!activity) return;
        state.target = {
          kind: 'encounter',
          activityId: activity.id,
          encounterId: firstDamageEncounter(activity).id
        };
      }
      this.render();
    });

    const arsenalHost = el<HTMLElement>('arsenal');
    arsenalHost?.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const state = this.state;
      if (!state) return;
      if (target.id === 'arsenal-load') {
        void this.ensureArsenal();
        return;
      }
      const slotPick = target.getAttribute('data-arsslot');
      if (slotPick !== null) {
        state.arsenalFilters.slot = slotPick as ArsenalFilters['slot'];
        this.paintArsenal();
        return;
      }
      if (target.getAttribute('data-arsroll') !== null) {
        state.arsenalFilters.damageRollOnly = !state.arsenalFilters.damageRollOnly;
        this.paintArsenal();
      }
    });
    arsenalHost?.addEventListener('change', (event) => {
      const target = event.target as HTMLElement;
      const state = this.state;
      if (!state) return;
      if (target.id === 'ars-archetype') {
        state.arsenalFilters.archetype = (target as HTMLSelectElement).value;
        this.paintArsenal();
      }
    });
  }

  // ----------------------------------------------------------- the arsenal

  /** Load the lazy chunk once, then paint. Failure is stated, not hidden. */
  private async ensureArsenal(): Promise<void> {
    if (this.arsenal) {
      this.paintArsenal();
      return;
    }
    if (this.arsenalLoading) return;
    this.arsenalLoading = true;
    const status = el<HTMLElement>('arsenal-status');
    if (status) status.textContent = 'Reading your full arsenal (loads separately so the page stays fast)...';
    try {
      this.arsenal = await loadArsenal();
      this.paintArsenal();
    } catch (error) {
      const table = el<HTMLElement>('arsenal-table');
      if (table) {
        table.innerHTML =
          `<p class="prose">The arsenal chunk failed to load (` +
          escapeText(error instanceof Error ? error.message : String(error)) +
          `). The answer above is unaffected; reload to retry.</p>`;
      }
    } finally {
      this.arsenalLoading = false;
    }
  }

  private paintArsenal(): void {
    const state = this.state;
    const arsenal = this.arsenal;
    const table = el<HTMLElement>('arsenal-table');
    if (!state || !arsenal || !table) return;

    let mode: Activity = 'boss-burst';
    let encounter: Encounter | null = null;
    let label = ACTIVITY_LABELS['boss-burst'];
    if (state.target.kind === 'encounter') {
      const hit = findEncounter(state.target.activityId, state.target.encounterId);
      if (hit && hit.encounter.type !== 'none') {
        encounter = hit.encounter;
        mode = encounterMode(hit.encounter);
        label = hit.encounter.name + ' (' + hit.activity.name + ')';
      }
    } else if (state.target.kind === 'mode' && state.target.activity !== 'pvp') {
      mode = state.target.activity === 'boss-sustained' ? 'boss-sustained' : 'boss-burst';
      label = ACTIVITY_LABELS[state.target.activity];
    }

    const rows = ownedArsenal(arsenal, state.profile);
    const ranked = rankArsenal(rows, mode, encounter);
    const iconPrefix = String(arsenal.meta.iconPrefix ?? '');
    table.innerHTML = arsenalTableHtml(ranked, state.arsenalFilters, iconPrefix, label);
    const status = el<HTMLElement>('arsenal-status');
    if (status) {
      status.textContent =
        'Your owned arsenal, read from the same profile as the answer above: ' +
        rows.length +
        ' weapons the bake knows about.';
    }
  }

  // ------------------------------------------------------ status in place

  private setStatus(html: string): void {
    const host = el<HTMLElement>('runbar-status');
    if (host) host.innerHTML = html;
  }

  private setProgress(note: string): void {
    this.setStatus(`<div class="notice notice--busy"><div class="notice__body">${escapeText(note)}</div></div>`);
  }

  private setNotice(message: { title: string; body: string }): void {
    this.setStatus(
      `<div class="notice"><div class="notice__title">${escapeText(message.title)}</div>` +
        `<div class="notice__body">${escapeText(message.body)}</div></div>`
    );
  }

  private setBusy(busy: boolean): void {
    for (const button of Array.from(this.root.querySelectorAll('.runbar button'))) {
      (button as HTMLButtonElement).disabled = busy;
    }
  }

  // ------------------------------------------------------------------ runs

  /**
   * Show a failure, and make sure the sign-in area agrees with it. Throwing
   * the session away when bungie.net rejects the token is the point of the
   * first line: a token can die before the clock says it should, and the
   * repaint has to come after the session is gone, not before.
   */
  private showFailure(error: unknown): void {
    if (isSessionExpiry(error)) signOut();
    this.setBusy(false);
    this.paintAccount();
    this.setNotice(failureText(error));
  }

  private async runMine(): Promise<void> {
    if (!signedIn()) {
      this.paintAccount();
      this.setNotice({
        title: 'That sign-in has run out',
        body: 'Bungie sessions last an hour and cannot be renewed. Sign in again and the answer will build.'
      });
      return;
    }

    this.setBusy(true);
    this.setProgress('Reading the account you signed in as.');

    try {
      const player = await getOwnPlayer();
      this.setProgress('Reading your vault, Collections and catalysts. One request, a few seconds.');
      // Read the session again rather than reusing one from before the call:
      // getOwnPlayer is where a quietly dead hour gets noticed.
      const token = getSession()?.accessToken ?? '';
      const profile = await getProfile(player, token);
      const data = parseProfile(profile);
      const previous = this.state;
      this.state = {
        source: 'live',
        playerName: formatBungieName(player),
        flagLine: '',
        data,
        profile,
        classType: availableClasses(data).includes(previous?.classType ?? 0)
          ? (previous?.classType ?? defaultClass(data))
          : defaultClass(data),
        activity: previous?.activity ?? 'boss-burst',
        target: previous?.target ?? { kind: 'mode', activity: 'boss-burst' },
        arsenalFilters: previous?.arsenalFilters ?? { ...DEFAULT_ARSENAL_FILTERS }
      };
      this.render();
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (error) {
      this.showFailure(error);
    }
  }
}
