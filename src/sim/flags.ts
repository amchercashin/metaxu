import type { FlagBag, ScrollKind, CampKind } from "./types";

export function emptyFlags(): FlagBag {
  return {
    scroll_intact: true,
    scroll_wet: false,
    scroll_lost: false,
    scroll_given: false,
    scroll_corrupt: false,
    named_to_stranger: false,
    debt_ford_keeper: false,
    saved_drowning: false,
    ignored_drowning: false,
    killed_animal: false,
    followed_night_tracks: false,
    left_silent_man: false,
    spoke_to_silent_man: false,
    pride_of_throw: false,
    camp_east_bank: false,
    camp_west_bank: false,
    no_fire: false,
    knows_ford: false,
    knows_others_crossed: false,
  };
}

const SCROLL_KEYS: ScrollKind[] = ["intact", "wet", "lost", "given"];
const CAMP_KEYS: CampKind[] = ["camp_east_bank", "camp_west_bank", "no_fire"];

export function syncScrollFlags(flags: FlagBag, scroll: ScrollKind): FlagBag {
  const next: FlagBag = { ...flags };
  next.scroll_intact = scroll === "intact";
  next.scroll_wet = scroll === "wet";
  next.scroll_lost = scroll === "lost";
  next.scroll_given = scroll === "given";
  return next;
}

export function setCamp(flags: FlagBag, camp: CampKind): FlagBag {
  const next: FlagBag = { ...flags };
  for (const key of CAMP_KEYS) next[key] = key === camp;
  return next;
}

export function scrollPresent(flags: FlagBag): boolean {
  return flags.scroll_intact || flags.scroll_wet || flags.scroll_given === false && !flags.scroll_lost;
}

export function hasScrollObject(flags: FlagBag): boolean {
  return !flags.scroll_lost && !flags.scroll_given;
}

export function flagIsOn(flags: FlagBag, name: string): boolean {
  if (name === "scroll_present") return hasScrollObject(flags);
  if (name in flags) return Boolean(flags[name as keyof FlagBag]);
  return false;
}

export { SCROLL_KEYS, CAMP_KEYS };
