import { freshBody } from "./body";
import { emptyFlags } from "./flags";
import { START_NAMES } from "./names";
import type { GameState, HeroId, HeroState } from "./types";

const RIVER_BIOMES = [
  "boulder_dawn",
  "river_approach",
  "river",
  "mist",
  "palm_lowland",
  "reeds",
  "ford",
  "far_bank",
];

function makeHero(id: HeroId): HeroState {
  const names = START_NAMES[id];
  return {
    id,
    spokenName: names.spokenName,
    nameDuty: names.nameDuty,
    body: freshBody(id),
  };
}

export function createNewGame(seed: number): GameState {
  return {
    version: 1,
    seed: seed >>> 0,
    rngDraws: 0,
    day: 1,
    phase: "morning",
    argument_of_day: null,
    selectedEventIds: [],
    completedEventIds: [],
    currentEventId: "RIVER_00",
    lastGestures: [],
    leader: "kleon",
    bank: "west",
    crossedRiver: false,
    scroll: "intact",
    lostFragmentId: null,
    flags: emptyFlags(),
    debts: [],
    heroes: {
      kleon: makeHero("kleon"),
      ariston: makeHero("ariston"),
    },
    recapNotes: [],
    eveningLines: [],
    biomeTags: [...RIVER_BIOMES],
  };
}

export function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

export function switchLeader(state: GameState): GameState {
  return { ...state, leader: state.leader === "kleon" ? "ariston" : "kleon" };
}

export function setLeader(state: GameState, id: HeroId): GameState {
  return { ...state, leader: id };
}

export function noteCrossedRiver(state: GameState): GameState {
  if (state.crossedRiver && state.bank === "east") return state;
  return { ...state, crossedRiver: true, bank: "east" };
}

export function noteReturnedWest(state: GameState): GameState {
  return { ...state, bank: "west" };
}
