import { applyBodyDelta, bodyCheck } from "./body";
import { addDebt } from "./debts";
import { syncScrollFlags } from "./flags";
import { applyNameDuty } from "./names";
import { createRng } from "./rng";
import { setScroll } from "./scroll";
import type { ChoiceEffects, EventCard, EventChoice, GameState, HeroId } from "./types";

function rngFrom(state: GameState, salt: number): () => number {
  return createRng((state.seed ^ (salt * 0x27d4eb2d) ^ (state.rngDraws * 16777619)) >>> 0);
}

function applyEffects(state: GameState, effects: ChoiceEffects): GameState {
  let next: GameState = {
    ...state,
    flags: { ...state.flags, ...(effects.flags ?? {}) },
    heroes: {
      kleon: { ...state.heroes.kleon, body: { ...state.heroes.kleon.body } },
      ariston: { ...state.heroes.ariston, body: { ...state.heroes.ariston.body } },
    },
    debts: [...state.debts],
    recapNotes: [...state.recapNotes],
  };
  if (effects.scroll) {
    next = setScroll(next, effects.scroll);
  } else {
    next.flags = syncScrollFlags(next.flags, next.scroll);
  }
  if (effects.lostFragmentId) next.lostFragmentId = effects.lostFragmentId;
  if (effects.recap) next.recapNotes.push(effects.recap);
  if (effects.debtsAdd) {
    for (const d of effects.debtsAdd) next = addDebt(next, d);
  }
  if (effects.body) {
    for (const key of Object.keys(effects.body) as (HeroId | "both" | "leader")[]) {
      const delta = effects.body[key];
      if (!delta) continue;
      const ids: HeroId[] =
        key === "both" ? ["kleon", "ariston"] : key === "leader" ? [state.leader] : [key];
      for (const id of ids) {
        next.heroes[id] = {
          ...next.heroes[id],
          body: applyBodyDelta(next.heroes[id].body, delta),
        };
      }
    }
  }
  if (effects.flags?.named_to_stranger) {
    next.heroes.ariston = applyNameDuty(next.heroes.ariston, next.heroes.ariston.spokenName, "имя, отданное чужому закону");
  }
  if (effects.flags?.debt_ford_keeper) {
    next.heroes.ariston = applyNameDuty(
      next.heroes.ariston,
      next.heroes.ariston.spokenName,
      "должник брода",
    );
  }
  return next;
}

export function findCard(cards: EventCard[], id: string): EventCard {
  const card = cards.find((c) => c.id === id);
  if (!card) throw new Error(`Нет карточки ${id}`);
  return card;
}

export function applyChoice(state: GameState, card: EventCard, choiceId: string): GameState {
  const choice: EventChoice | undefined = card.choices.find((c) => c.id === choiceId);
  if (!choice) throw new Error(`Нет выбора ${choiceId} в ${card.id}`);
  let effects: ChoiceEffects;
  let extraDraws = 1;
  if (choice.bodyCheck) {
    const heroId = choice.bodyCheck.hero === "leader" ? state.leader : choice.bodyCheck.hero;
    const rng = rngFrom(state, choiceId.length + card.ribbonOrder * 17);
    const ok = bodyCheck(state.heroes[heroId], choice.bodyCheck.demand, rng, choice.bodyCheck.threshold);
    extraDraws += 2;
    effects = ok ? choice.bodyCheck.pass : choice.bodyCheck.fail;
  } else {
    effects = choice.effects ?? {};
  }
  let next = applyEffects(state, effects);
  next = {
    ...next,
    rngDraws: next.rngDraws + extraDraws,
    recapNotes: choice.line ? [...next.recapNotes.filter((n) => n !== choice.line), ...next.recapNotes.filter((n) => n === choice.line)] : next.recapNotes,
  };
  if (choice.line && !next.recapNotes.includes(choice.line)) {
    next = { ...next, recapNotes: [...next.recapNotes, choice.line] };
  }
  return next;
}

export function completeEvent(state: GameState, eventId: string): GameState {
  const completed = state.completedEventIds.includes(eventId)
    ? state.completedEventIds
    : [...state.completedEventIds, eventId];
  const remaining = state.selectedEventIds.filter((id) => !completed.includes(id));
  if (remaining.length === 0) {
    return {
      ...state,
      completedEventIds: completed,
      currentEventId: null,
      phase: "evening",
    };
  }
  return {
    ...state,
    completedEventIds: completed,
    currentEventId: null,
    phase: "travel",
  };
}

export function openEvent(state: GameState, eventId: string): GameState {
  return { ...state, phase: "event", currentEventId: eventId };
}

export function openMorning(state: GameState): GameState {
  return { ...state, phase: "morning", currentEventId: "RIVER_00" };
}
