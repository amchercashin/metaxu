import type { EventCard } from "../sim/types";
import river00 from "./events/river_00.json";
import river01 from "./events/river_01.json";
import river02 from "./events/river_02.json";
import river03 from "./events/river_03.json";
import river04 from "./events/river_04.json";
import river05 from "./events/river_05.json";
import river06 from "./events/river_06.json";
import river07 from "./events/river_07.json";
import river08 from "./events/river_08.json";

export const RIVER_CARDS: EventCard[] = [
  river00,
  river01,
  river02,
  river03,
  river04,
  river05,
  river06,
  river07,
  river08,
] as EventCard[];

export function loadRiverCatalog(): EventCard[] {
  return RIVER_CARDS;
}

export function cardById(id: string): EventCard | undefined {
  return RIVER_CARDS.find((c) => c.id === id);
}
