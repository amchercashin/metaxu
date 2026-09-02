import type { HeroId, HeroState } from "./types";

export const START_NAMES: Record<HeroId, { spokenName: string; nameDuty: string }> = {
  kleon: { spokenName: "Клеон", nameDuty: "сын школы" },
  ariston: { spokenName: "Аристон", nameDuty: "сын школы" },
};

export function applyNameDuty(hero: HeroState, spokenName: string, nameDuty: string): HeroState {
  return { ...hero, spokenName, nameDuty };
}

export function roadName(hero: HeroState): string {
  if (hero.nameDuty === "гость дороги") return "гость";
  if (hero.nameDuty === "должник брода") return hero.spokenName;
  return hero.spokenName;
}
