import { flagIsOn } from "./flags";
import { createRng, pickWeighted, shuffleInPlace, type Rng } from "./rng";
import type { EventCard, GameState, Gesture } from "./types";

export const POOL_IDS = [
  "RIVER_01",
  "RIVER_02",
  "RIVER_03",
  "RIVER_04",
  "RIVER_05",
  "RIVER_06",
  "RIVER_07",
  "RIVER_08",
] as const;

function rngForState(state: GameState): Rng {
  const rng = createRng(state.seed ^ (state.day * 0x9e3779b9) ^ (state.rngDraws * 0x85ebca6b));
  return rng;
}

export function meetsRequires(card: EventCard, state: GameState): boolean {
  for (const req of card.requires) {
    if (!flagIsOn(state.flags, req)) return false;
  }
  return true;
}

export function isForbidden(card: EventCard, state: GameState): boolean {
  for (const f of card.forbidden_if) {
    if (flagIsOn(state.flags, f)) return true;
  }
  return false;
}

export function eligibleCards(cards: EventCard[], state: GameState): EventCard[] {
  return cards.filter((c) => POOL_IDS.includes(c.id as (typeof POOL_IDS)[number]) && meetsRequires(c, state) && !isForbidden(c, state));
}

export function scoreCard(card: EventCard, state: GameState, rng: Rng): number {
  let score = 1.2 + rng() * 3.4;
  for (const tag of card.biome_tags) {
    if (state.biomeTags.includes(tag)) score += 0.85;
  }
  if (state.argument_of_day === "haste" && card.gesture === "read_water") score -= 0.4;
  if (state.argument_of_day === "distinction" && (card.gesture === "silence" || card.gesture === "throw")) score += 0.55;
  if (state.argument_of_day === "node" && (card.gesture === "rescue" || card.gesture === "keeper")) score += 0.45;
  if (card.primary_bearer === state.leader) score += 0.2;
  if (state.lastGestures.includes(card.gesture)) score -= 6;
  return score;
}

function pickOne(candidates: EventCard[], state: GameState, rng: Rng, used: Set<Gesture>): EventCard | null {
  const fresh = candidates.filter((c) => !used.has(c.gesture));
  const pool = fresh.length > 0 ? fresh : candidates;
  if (pool.length === 0) return null;
  const weights = pool.map((c) => Math.max(0.05, scoreCard(c, state, rng)));
  return pickWeighted(pool, weights, rng);
}

/** Seeded director: 3 cards, no repeated gesture, requires/forbidden honored. */
export function pickDayEvents(cards: EventCard[], state: GameState): EventCard[] {
  const rng = rngForState(state);
  const eligible = eligibleCards(cards, state);
  shuffleInPlace(eligible, rng);
  const picked: EventCard[] = [];
  const used = new Set<Gesture>(state.lastGestures);
  const remaining = [...eligible];
  while (picked.length < 3 && remaining.length > 0) {
    const choice = pickOne(remaining, state, rng, used);
    if (!choice) break;
    picked.push(choice);
    used.add(choice.gesture);
    const idx = remaining.findIndex((c) => c.id === choice.id);
    if (idx >= 0) remaining.splice(idx, 1);
  }
  picked.sort((a, b) => a.ribbonOrder - b.ribbonOrder);
  return picked;
}

export function applyPicks(state: GameState, picked: EventCard[]): GameState {
  return {
    ...state,
    selectedEventIds: picked.map((c) => c.id),
    lastGestures: [...state.lastGestures, ...picked.map((c) => c.gesture)],
    rngDraws: state.rngDraws + 8,
  };
}

export function triplesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, i) => id === b[i]);
}
