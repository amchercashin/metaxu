import type { Debt, GameState } from "./types";

export function addDebt(state: GameState, debt: Debt): GameState {
  if (state.debts.some((d) => d.id === debt.id)) return state;
  return { ...state, debts: [...state.debts, debt] };
}

export function hasDebt(state: GameState, id: string): boolean {
  return state.debts.some((d) => d.id === id);
}
