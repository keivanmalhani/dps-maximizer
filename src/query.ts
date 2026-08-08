// A search language for your own arsenal.
//
// DIM taught every Destiny player to type `is:exotic perk:"bait and switch"`
// instead of hunting through a grid, and the three chips this page shipped
// with cannot express "power slot, has a damage roll, not a sword". So this
// is a real query language over the rows the arsenal table already builds.
//
// It invents nothing. Every field it can filter on is either a manifest fact
// baked at build time (slot, rarity, type, frame, archetype) or something
// read from this player's own profile (roll perks, duplicate count), and the
// tier fields come from the curated sheet with its own label. There is no
// scoring here and no opinion: a query says yes or no about a row.
//
// Pure and DOM-free on purpose, so every operator below is unit-tested.

import type { RankedArsenalRow } from './arsenal';

// --------------------------------------------------------------- the syntax

export interface QueryError {
  message: string;
  /** Character offset the parser gave up at, for the caret in the hint. */
  at: number;
}

type Node =
  | { kind: 'and'; nodes: Node[] }
  | { kind: 'or'; nodes: Node[] }
  | { kind: 'not'; node: Node }
  | { kind: 'term'; key: string | null; value: string; op: Compare | null; num: number | null };

type Compare = '>' | '<' | '>=' | '<=' | '=';

interface Token {
  text: string;
  at: number;
  /**
   * True when the token was ENTIRELY inside quotes. `and`, `or` and `not` are
   * operators unquoted and ordinary search words quoted, so this flag has to
   * travel with every token.
   */
  quoted: boolean;
  /**
   * Index of the first colon that appeared OUTSIDE quotes, or -1. Without
   * this, `perk:"bait and switch"` looks fully quoted and the key is lost,
   * which is exactly the bug the tests caught.
   */
  colon: number;
}

function tokenize(input: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      i += 1;
      continue;
    }
    if (ch === '(' || ch === ')') {
      out.push({ text: ch, at: i, quoted: false, colon: -1 });
      i += 1;
      continue;
    }
    const start = i;
    let text = '';
    let sawQuote = false;
    let anyBare = false;
    let colon = -1;
    while (i < input.length) {
      const c = input[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '(' || c === ')') break;
      if (c === '"') {
        sawQuote = true;
        i += 1;
        while (i < input.length && input[i] !== '"') {
          text += input[i];
          i += 1;
        }
        // An unterminated quote reads to the end rather than erroring: people
        // type queries live and the half-typed state should still search.
        if (i < input.length) i += 1;
        continue;
      }
      if (c === ':' && colon === -1) colon = text.length;
      anyBare = true;
      text += c;
      i += 1;
    }
    out.push({ text, at: start, quoted: sawQuote && !anyBare, colon });
  }
  return out;
}

const COMPARE_RE = /^(>=|<=|>|<|=)(\d+(?:\.\d+)?)$/;

function termOf(token: Token): Node {
  let raw = token.text;
  let negated = false;
  if (!token.quoted && raw.startsWith('-') && raw.length > 1) {
    negated = true;
    raw = raw.slice(1);
  }
  // The colon that splits key from value is the first one the tokenizer saw
  // outside quotes, shifted by anything the leading `-` removed.
  const colon = token.quoted ? -1 : token.colon - (negated ? 1 : 0);
  let key: string | null = null;
  let value = raw;
  if (colon > 0) {
    key = raw.slice(0, colon).toLowerCase();
    value = raw.slice(colon + 1);
  }
  if (value.startsWith('"') && value.endsWith('"') && value.length > 1) {
    value = value.slice(1, -1);
  }
  let op: Compare | null = null;
  let num: number | null = null;
  const cmp = COMPARE_RE.exec(value);
  if (cmp) {
    op = cmp[1] as Compare;
    num = Number(cmp[2]);
  }
  const node: Node = { kind: 'term', key, value: value.toLowerCase(), op, num };
  return negated ? { kind: 'not', node } : node;
}

/** Recursive descent: or > and > not > primary. */
function parse(tokens: Token[]): { node: Node | null; error: QueryError | null } {
  let pos = 0;
  let error: QueryError | null = null;

  const peek = () => tokens[pos];
  const fail = (message: string, at: number) => {
    if (!error) error = { message, at };
    return null;
  };

  function parseOr(): Node | null {
    const first = parseAnd();
    if (first === null) return null;
    const nodes = [first];
    while (peek() && !peek().quoted && peek().text.toLowerCase() === 'or') {
      pos += 1;
      const next = parseAnd();
      if (next === null) return fail('Nothing after "or".', tokens[pos - 1]?.at ?? 0);
      nodes.push(next);
    }
    return nodes.length === 1 ? nodes[0] : { kind: 'or', nodes };
  }

  function parseAnd(): Node | null {
    const nodes: Node[] = [];
    for (;;) {
      const t = peek();
      if (!t) break;
      if (t.text === ')') break;
      if (!t.quoted && t.text.toLowerCase() === 'or') break;
      if (!t.quoted && t.text.toLowerCase() === 'and') {
        pos += 1;
        continue;
      }
      const node = parseNot();
      if (node === null) return null;
      nodes.push(node);
    }
    if (nodes.length === 0) return fail('Empty group.', peek()?.at ?? 0);
    return nodes.length === 1 ? nodes[0] : { kind: 'and', nodes };
  }

  function parseNot(): Node | null {
    const t = peek();
    if (t && !t.quoted && t.text.toLowerCase() === 'not') {
      pos += 1;
      const node = parseNot();
      if (node === null) return fail('Nothing after "not".', t.at);
      return { kind: 'not', node };
    }
    return parsePrimary();
  }

  function parsePrimary(): Node | null {
    const t = peek();
    if (!t) return fail('Query ended early.', 0);
    if (t.text === '(') {
      pos += 1;
      const inner = parseOr();
      if (inner === null) return null;
      const close = peek();
      if (!close || close.text !== ')') return fail('Unclosed "(".', t.at);
      pos += 1;
      return inner;
    }
    if (t.text === ')') return fail('Unmatched ")".', t.at);
    if (t.text === '' && !t.quoted && t.colon === -1) {
      pos += 1;
      return { kind: 'term', key: null, value: '', op: null, num: null };
    }
    pos += 1;
    return termOf(t);
  }

  const node = parseOr();
  if (error) return { node: null, error };
  if (pos < tokens.length) {
    return { node: null, error: { message: 'Unexpected "' + tokens[pos].text + '".', at: tokens[pos].at } };
  }
  return { node, error: null };
}

// -------------------------------------------------------------- the fields

/** Every key the language understands, with the words shown in the hint. */
export const QUERY_KEYS: Array<{ key: string; help: string }> = [
  { key: 'is:', help: 'kinetic, energy, power, exotic, legendary, tiered, untiered, roll, noroll, dupe, flagged' },
  { key: 'slot:', help: 'kinetic, energy, power' },
  { key: 'type:', help: 'the weapon type or archetype, e.g. type:sniper' },
  { key: 'frame:', help: 'the intrinsic frame, e.g. frame:"rapid-fire"' },
  { key: 'perk:', help: 'a damage perk on YOUR copy, e.g. perk:"bait and switch"' },
  { key: 'wish:', help: 'a perk on the wishlist for that weapon' },
  { key: 'tier:', help: '1, 2, 3, 4, or a comparison like tier:<=2' },
  { key: 'count:', help: 'how many copies you own, e.g. count:>1' },
  { key: 'name:', help: 'match the weapon name only' }
];

/** Ready-made queries, each one a thing a player actually wants to ask. */
export const QUERY_EXAMPLES: Array<{ label: string; query: string }> = [
  { label: 'Power slot, damage roll', query: 'is:power is:roll' },
  { label: 'Tiered and buildable', query: 'is:tiered is:roll' },
  { label: 'Snipers without a roll', query: 'type:sniper is:noroll' },
  { label: 'Bait and Switch copies', query: 'perk:"bait and switch"' },
  { label: 'Legendary heavies, no swords', query: 'is:power is:legendary -type:sword' },
  { label: 'Duplicates worth culling', query: 'count:>1 is:noroll -is:tiered' }
];

function haystack(row: RankedArsenalRow): string {
  const w = row.weapon;
  return [w.name, w.itemTypeDisplayName, w.archetype, w.frame ?? '', row.tierLabel ?? '']
    .join(' ')
    .toLowerCase();
}

function tierNumber(row: RankedArsenalRow): number | null {
  if (!row.tierLabel) return null;
  const m = /(\d+)/.exec(row.tierLabel);
  return m ? Number(m[1]) : null;
}

function compare(actual: number | null, op: Compare, want: number): boolean {
  if (actual === null) return false;
  if (op === '>') return actual > want;
  if (op === '<') return actual < want;
  if (op === '>=') return actual >= want;
  if (op === '<=') return actual <= want;
  return actual === want;
}

function has(list: string[] | null | undefined, needle: string): boolean {
  if (!list) return false;
  return list.some((v) => v.toLowerCase().includes(needle));
}

function matchIs(row: RankedArsenalRow, value: string): boolean {
  const w = row.weapon;
  switch (value) {
    case 'kinetic':
    case 'energy':
    case 'power':
      return w.slot === value;
    case 'exotic':
      return w.tierType === 6;
    case 'legendary':
      return w.tierType !== 6;
    case 'tiered':
      return row.tierLabel !== null;
    case 'untiered':
      return row.tierLabel === null;
    case 'roll':
      return (row.rollPerks?.length ?? 0) > 0;
    case 'noroll':
      return (row.rollPerks?.length ?? 0) === 0;
    case 'unknownroll':
      return row.rollPerks === null;
    case 'dupe':
      return row.instanceCount > 1;
    case 'flagged':
      return row.flags.length > 0;
    case 'sourced':
      return row.archetypeSourced;
    case 'unsourced':
      return !row.archetypeSourced;
    default:
      // An unknown is: value matches nothing rather than everything. A filter
      // that silently passes is worse than one that returns zero rows.
      return false;
  }
}

function matchTerm(row: RankedArsenalRow, term: Extract<Node, { kind: 'term' }>): boolean {
  const { key, value, op, num } = term;
  if (value === '' && key === null) return true;
  const w = row.weapon;
  switch (key) {
    case null:
      return haystack(row).includes(value);
    case 'is':
      return matchIs(row, value);
    case 'not':
      return !matchIs(row, value);
    case 'slot':
      return w.slot === value;
    case 'type':
      return (
        w.archetype.toLowerCase().includes(value) ||
        w.itemTypeDisplayName.toLowerCase().includes(value)
      );
    case 'frame':
      return (w.frame ?? '').toLowerCase().includes(value);
    case 'perk':
      return has(row.rollPerks, value);
    case 'wish':
      return has(row.wishlist, value);
    case 'name':
      return w.name.toLowerCase().includes(value);
    case 'tier':
      if (op !== null && num !== null) return compare(tierNumber(row), op, num);
      return (row.tierLabel ?? '').toLowerCase().includes(value);
    case 'count':
      if (op !== null && num !== null) return compare(row.instanceCount, op, num);
      return row.instanceCount === Number(value);
    default:
      // Unknown key: treat the whole thing as free text so a typo narrows
      // the list instead of silently ignoring what was typed.
      return haystack(row).includes(key + ':' + value);
  }
}

function evaluate(row: RankedArsenalRow, node: Node): boolean {
  if (node.kind === 'and') return node.nodes.every((n) => evaluate(row, n));
  if (node.kind === 'or') return node.nodes.some((n) => evaluate(row, n));
  if (node.kind === 'not') return !evaluate(row, node.node);
  return matchTerm(row, node);
}

export interface QueryResult {
  rows: RankedArsenalRow[];
  error: QueryError | null;
  /** True when the query was blank, so the caller can skip the "0 of N" line. */
  empty: boolean;
}

/**
 * Run a query. A blank query returns everything; a broken query returns
 * everything WITH the error, because blanking the table while somebody is
 * halfway through typing is hostile.
 */
export function runQuery(rows: RankedArsenalRow[], input: string): QueryResult {
  const trimmed = input.trim();
  if (trimmed === '') return { rows, error: null, empty: true };
  const { node, error } = parse(tokenize(trimmed));
  if (error || node === null) return { rows, error: error ?? { message: 'Could not read that query.', at: 0 }, empty: false };
  return { rows: rows.filter((row) => evaluate(row, node)), error: null, empty: false };
}

/** Exposed for the tests: the parse tree without running it. */
export function parseQuery(input: string): { ok: boolean; error: QueryError | null } {
  const { node, error } = parse(tokenize(input.trim()));
  return { ok: node !== null && error === null, error };
}

// ------------------------------------------------------- handing off to DIM
//
// DIM does not publish a URL format for sharing a loadout, so this does not
// invent one. What it produces is a SEARCH, in DIM's own documented syntax:
// quoted terms joined by `or`, which DIM matches against item names. Paste it
// into DIM's search box and the three weapons light up in your vault.

export const DIM_SOURCE = 'DIM Item Search wiki, syntax: quoted terms with or';

export function dimSearchFor(names: string[]): string {
  const unique = [...new Set(names.filter((n) => n.trim() !== ''))];
  if (unique.length === 0) return '';
  return unique.map((n) => '"' + n.replace(/"/g, '') + '"').join(' or ');
}
