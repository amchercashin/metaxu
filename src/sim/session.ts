import { applyPicks, pickDayEvents } from "./director";
import { campChoices, composeEvening } from "./evening";
import { applyChoice, completeEvent, findCard, openEvent } from "./resolve";
import { createNewGame } from "./state";
import type { ArgumentOfDay, CampKind, EventCard, GameState } from "./types";

export function startDay(cards: EventCard[], seed: number): GameState {
  return createNewGame(seed);
}

export function resolveMorning(state: GameState, cards: EventCard[], choiceId: string): GameState {
  const morning = findCard(cards, "RIVER_00");
  let next = applyChoice(state, morning, choiceId);
  const argMap: Record<string, ArgumentOfDay> = {
    node: "node",
    distinction: "distinction",
    haste: "haste",
  };
  next = { ...next, argument_of_day: argMap[choiceId] ?? next.argument_of_day };
  const picks = pickDayEvents(cards, next);
  next = applyPicks(next, picks);
  next = { ...next, phase: "travel", currentEventId: null };
  return next;
}

export function beginEvent(state: GameState, eventId: string): GameState {
  if (!state.selectedEventIds.includes(eventId)) return state;
  if (state.completedEventIds.includes(eventId)) return state;
  return openEvent(state, eventId);
}

export function resolveEvent(state: GameState, cards: EventCard[], choiceId: string): GameState {
  if (!state.currentEventId) return state;
  const card = findCard(cards, state.currentEventId);
  const chosen = applyChoice(state, card, choiceId);
  return completeEvent(chosen, card.id);
}

export function finishEvening(state: GameState, camp: CampKind): GameState {
  return composeEvening(state, camp);
}

export { campChoices };
