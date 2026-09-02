import type { GameState, ScrollKind } from "./types";
import { syncScrollFlags, hasScrollObject } from "./flags";

export function setScroll(state: GameState, kind: ScrollKind): GameState {
  return {
    ...state,
    scroll: kind,
    flags: syncScrollFlags(state.flags, kind),
  };
}

export function carryingScroll(state: GameState): boolean {
  return hasScrollObject(state.flags);
}

export function dropScrollInWater(state: GameState): GameState {
  if (!carryingScroll(state)) return state;
  return {
    ...setScroll(state, "lost"),
    recapNotes: [...state.recapNotes, "Свиток ушёл в толщу. Река не торгуется."],
  };
}

export function wetScroll(state: GameState): GameState {
  if (state.scroll === "lost" || state.scroll === "given") return state;
  return setScroll(state, "wet");
}
