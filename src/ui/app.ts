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

import { getSession, minutesLeft, signIn, signOut, signedIn } from '../auth';
import { formatBungieName, getProfile } from '../bungie';
import { buildDemoProfile, DEMO_FLAG_LINE, DEMO_PLAYER } from '../../fixtures/demo';
import { escapeText } from '../format';
import { parseProfile } from '../ownership';
import { recommend, type Verdict } from '../recommend';
import { failureText, getOwnPlayer, isSessionExpiry, signInView } from '../signin';
import type { SignInView } from '../signin';
import type { Activity, GuardianClass, PlayerData } from '../types';
import { resultPage, runbar, type PageModel } from './sections';

export interface AppState {
  source: 'demo' | 'live';
  playerName: string;
  flagLine: string;
  data: PlayerData;
  classType: GuardianClass;
  activity: Activity;
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

  constructor(root: HTMLElement) {
    this.root = root;
  }

  start(): void {
    const data = parseProfile(buildDemoProfile());
    this.state = {
      source: 'demo',
      playerName: formatBungieName(DEMO_PLAYER),
      flagLine: DEMO_FLAG_LINE,
      data,
      classType: defaultClass(data),
      activity: 'boss-burst'
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
      character: state.data.characters.find((c) => c.classType === state.classType) ?? null
    };
  }

  private verdict(state: AppState): Verdict {
    return recommend(state.data, state.classType, state.activity);
  }

  private render(): void {
    const state = this.state;
    if (!state) return;
    const model = this.pageModel(state);
    this.root.innerHTML =
      this.masthead() + resultPage(model, this.verdict(state), this.account());
    this.bind();
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
      const state = this.state;
      if (!state) return;
      if (classPick !== null) {
        state.classType = Number(classPick) as GuardianClass;
        this.render();
      } else if (activityPick !== null) {
        state.activity = activityPick as Activity;
        this.render();
      }
    });
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
        classType: availableClasses(data).includes(previous?.classType ?? 0)
          ? (previous?.classType ?? defaultClass(data))
          : defaultClass(data),
        activity: previous?.activity ?? 'boss-burst'
      };
      this.render();
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (error) {
      this.showFailure(error);
    }
  }
}
