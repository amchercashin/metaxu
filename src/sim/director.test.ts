import { describe, expect, it } from "vitest";
import { loadRiverCatalog } from "../content/catalog";
import { eligibleCards, pickDayEvents } from "./director";
import { saveState, loadState, MemorySaveAdapter, toSnapshot, fromSnapshot } from "./save";
import { createNewGame } from "./state";
import { resolveMorning, resolveEvent, beginEvent, finishEvening } from "./session";
import { setScroll } from "./scroll";

const cards = loadRiverCatalog();

describe("director", () => {
  it("three seeds yield three different event triples", () => {
    const triples: string[][] = [];
    for (const seed of [11, 29, 47]) {
      let state = createNewGame(seed);
      state = resolveMorning(state, cards, "distinction");
      expect(state.selectedEventIds).toHaveLength(3);
      expect(new Set(state.selectedEventIds).size).toBe(3);
      triples.push([...state.selectedEventIds]);
    }
    const key = (t: string[]) => t.join("|");
    expect(new Set(triples.map(key)).size).toBe(3);
  });

  it("forbidden_if honors scroll_lost for RIVER_08", () => {
    let state = createNewGame(7);
    state = setScroll(state, "lost");
    const eligible = eligibleCards(cards, state);
    expect(eligible.map((c) => c.id)).not.toContain("RIVER_08");
    const picked = pickDayEvents(cards, state);
    expect(picked.map((c) => c.id)).not.toContain("RIVER_08");
    expect(picked).toHaveLength(3);
  });

  it("requires scroll_present keeps RIVER_08 when the scroll is carried", () => {
    const state = createNewGame(3);
    const eligible = eligibleCards(cards, state);
    expect(eligible.map((c) => c.id)).toContain("RIVER_08");
  });

  it("does not repeat a gesture inside one day", () => {
    const state = resolveMorning(createNewGame(101), cards, "node");
    const picked = cards.filter((c) => state.selectedEventIds.includes(c.id));
    const gestures = picked.map((c) => c.gesture);
    expect(new Set(gestures).size).toBe(gestures.length);
  });
});

describe("save snapshot", () => {
  it("roundtrips through the in-memory adapter", async () => {
    let state = createNewGame(42);
    state = resolveMorning(state, cards, "node");
    const first = state.selectedEventIds[0];
    state = beginEvent(state, first);
    state = resolveEvent(state, cards, cards.find((c) => c.id === first)!.choices[0].id);
    const adapter = new MemorySaveAdapter();
    const snap = await saveState(adapter, state, "day");
    const loaded = await loadState(adapter, "day");
    expect(loaded).toEqual(state);
    expect(fromSnapshot(toSnapshot(state)).flags).toEqual(state.flags);
    expect(snap.version).toBe(1);
    expect(loaded?.selectedEventIds).toEqual(state.selectedEventIds);
  });

  it("evening recap stays unfinished", () => {
    let state = createNewGame(5);
    state = resolveMorning(state, cards, "haste");
    for (const id of state.selectedEventIds) {
      state = beginEvent(state, id);
      const card = cards.find((c) => c.id === id)!;
      state = resolveEvent(state, cards, card.choices[0].id);
    }
    state = finishEvening(state, "no_fire");
    expect(state.phase).toBe("evening");
    expect(state.eveningLines.some((l) => l.includes("не закрыт") || l.includes("Ночь не учитель"))).toBe(true);
  });
});
