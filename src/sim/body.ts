import type { BodyDelta, BodyState, HeroId, HeroState } from "./types";
import type { Rng } from "./rng";

export function freshBody(kind: HeroId): BodyState {
  if (kind === "kleon") {
    return {
      satiety: 0.72,
      thirst: 0.35,
      sleep: 0.55,
      fatigue: 0.22,
      cold: 0.28,
      heat: 0.1,
      wound: 0,
      illness: 0,
      wet: false,
    };
  }
  return {
    satiety: 0.78,
    thirst: 0.3,
    sleep: 0.6,
    fatigue: 0.18,
    cold: 0.2,
    heat: 0.08,
    wound: 0,
    illness: 0,
    wet: false,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function applyBodyDelta(body: BodyState, delta: BodyDelta): BodyState {
  const next: BodyState = { ...body };
  if (delta.satiety !== undefined) next.satiety = clamp01(next.satiety + delta.satiety);
  if (delta.thirst !== undefined) next.thirst = clamp01(next.thirst + delta.thirst);
  if (delta.sleep !== undefined) next.sleep = clamp01(next.sleep + delta.sleep);
  if (delta.fatigue !== undefined) next.fatigue = clamp01(next.fatigue + delta.fatigue);
  if (delta.cold !== undefined) next.cold = clamp01(next.cold + delta.cold);
  if (delta.heat !== undefined) next.heat = clamp01(next.heat + delta.heat);
  if (delta.wound !== undefined) next.wound = clamp01(next.wound + delta.wound);
  if (delta.illness !== undefined) next.illness = clamp01(next.illness + delta.illness);
  if (delta.wet !== undefined) next.wet = delta.wet;
  return next;
}

export type BodyDemand = "swim_burden" | "stand_cold" | "strike" | "hold_ground";

export function bodyScore(hero: HeroState, demand: BodyDemand): number {
  const b = hero.body;
  const dense = hero.id === "ariston" ? 0.08 : 0;
  const light = hero.id === "kleon" ? 0.06 : 0;
  switch (demand) {
    case "swim_burden":
      return (1 - b.fatigue) * 0.35 + (1 - b.wound) * 0.25 + (1 - b.cold) * 0.2 + (b.satiety) * 0.1 + dense;
    case "stand_cold":
      return (1 - b.cold) * 0.4 + (1 - b.fatigue) * 0.3 + (b.wet ? 0 : 0.2) + dense;
    case "strike":
      return (1 - b.wound) * 0.35 + (1 - b.fatigue) * 0.3 + dense * 1.4 + light * 0.4;
    case "hold_ground":
      return (1 - b.fatigue) * 0.3 + (1 - b.wound) * 0.25 + dense * 1.5 + 0.2;
    default:
      return 0.5;
  }
}

export function bodyCheck(hero: HeroState, demand: BodyDemand, rng: Rng, threshold = 0.48): boolean {
  const score = bodyScore(hero, demand) + rng() * 0.18;
  return score >= threshold;
}
