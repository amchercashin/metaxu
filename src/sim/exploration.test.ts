import { describe, expect, it } from "vitest";
import {
  ABDERA_REGION_ID,
  cellIdAt,
  createAbderaRegionMap,
  createExplorationState,
  deserializeExplorationState,
  getCell,
  getCellKnowledge,
  getDiscoveredLandmarks,
  getTravelOptions,
  hexDistance,
  moveParty,
  serializeExplorationState,
  setRevealRadius,
} from "./exploration";

describe("Abdera region map", () => {
  it("is deterministic, serializable, and renderer-neutral", () => {
    const first = createAbderaRegionMap(431);
    const repeated = createAbderaRegionMap(431);
    const otherSeed = createAbderaRegionMap(432);

    expect(repeated).toEqual(first);
    expect(otherSeed.id).not.toBe(first.id);
    expect(otherSeed.cells.map((cell) => cell.id)).toEqual(first.cells.map((cell) => cell.id));
    expect(otherSeed.cells.map((cell) => cell.worldPosition.y)).not.toEqual(
      first.cells.map((cell) => cell.worldPosition.y),
    );
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(first.regionId).toBe(ABDERA_REGION_ID);
    expect(first.epoch.yearBce).toBe(430);
    expect(first.cells).toHaveLength(37);
    expect(getCell(first, first.startCellId)?.terrain).toBe("polis");
    expect(first.landmarks.map((landmark) => landmark.id)).toContain("abdera-polis");

    const knownIds = new Set(first.cells.map((cell) => cell.id));
    for (const cell of first.cells) {
      expect(Number.isFinite(cell.worldPosition.x)).toBe(true);
      expect(Number.isFinite(cell.worldPosition.y)).toBe(true);
      expect(Number.isFinite(cell.worldPosition.z)).toBe(true);
      expect(cell.neighborIds.every((id) => knownIds.has(id))).toBe(true);
    }
  });

  it("uses axial distance for sight and adjacency", () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
    expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: -1 })).toBe(1);
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: -1 })).toBe(2);
  });
});

describe("fog-of-war exploration", () => {
  it("reveals a radius around Abdera but visits only the party cell", () => {
    const map = createAbderaRegionMap(17);
    const state = createExplorationState(map);

    expect(state.partyCellId).toBe(cellIdAt({ q: 0, r: 0 }));
    expect(state.visibleCellIds).toHaveLength(7);
    expect(state.exploredCellIds).toEqual(state.visibleCellIds);
    expect(state.visitedCellIds).toEqual([map.startCellId]);
    expect(state.discoveredLandmarkIds).toEqual(["abdera-polis"]);
    expect(getCellKnowledge(state, cellIdAt({ q: 2, r: 0 }))).toEqual({ fog: "hidden", visited: false });
  });

  it("moves one cell, preserves old fog knowledge, and reports discoveries", () => {
    const map = createAbderaRegionMap(17);
    const initial = createExplorationState(map);
    const east = cellIdAt({ q: 1, r: 0 });
    const result = moveParty(map, initial, east);

    expect(initial.partyCellId).toBe(map.startCellId);
    expect(initial.travelCount).toBe(0);
    expect(result.state.partyCellId).toBe(east);
    expect(result.state.travelCount).toBe(1);
    expect(result.state.visitedCellIds).toEqual(expect.arrayContaining([map.startCellId, east]));
    expect(result.movement.fromCellId).toBe(map.startCellId);
    expect(result.movement.toCellId).toBe(east);
    expect(result.movement.toWorldPosition).toEqual(getCell(map, east)?.worldPosition);
    expect(result.movement.newlyDiscoveredLandmarkIds).toContain("east-road-marker");
    expect(getDiscoveredLandmarks(map, result.state).map((landmark) => landmark.id)).toContain("east-road-marker");

    const oldWesternEdge = cellIdAt({ q: -1, r: 0 });
    expect(getCellKnowledge(result.state, oldWesternEdge)).toEqual({ fog: "explored", visited: false });
  });

  it("exposes valid neighboring travel options for UI and movement", () => {
    const map = createAbderaRegionMap(22);
    const state = createExplorationState(map);
    const options = getTravelOptions(map, state);

    expect(options).toHaveLength(6);
    expect(options.every((option) => option.movementCost > 0)).toBe(true);
    expect(options.every((option) => Number.isFinite(option.worldPosition.x))).toBe(true);
    expect(options.every((option) => option.explored)).toBe(true);
  });

  it("rejects jumps and impassable water", () => {
    const map = createAbderaRegionMap(22);
    const state = createExplorationState(map);
    expect(() => moveParty(map, state, cellIdAt({ q: 2, r: 0 }))).toThrow(/adjacent/);

    const harborState = createExplorationState(map, { startCellId: cellIdAt({ q: 0, r: 2 }) });
    expect(() => moveParty(map, harborState, cellIdAt({ q: 0, r: 3 }))).toThrow(/impassable/);
  });

  it("can widen the reveal radius without marking cells as visited", () => {
    const map = createAbderaRegionMap(9);
    const initial = createExplorationState(map);
    const widened = setRevealRadius(map, initial, 2);

    expect(widened.visibleCellIds).toHaveLength(19);
    expect(widened.exploredCellIds).toHaveLength(19);
    expect(widened.visitedCellIds).toEqual([map.startCellId]);
    expect(initial.visibleCellIds).toHaveLength(7);
  });
});

describe("exploration saves", () => {
  it("roundtrips the complete fog and travel state", () => {
    const map = createAbderaRegionMap(101);
    const moved = moveParty(map, createExplorationState(map), cellIdAt({ q: 1, r: 0 })).state;
    const restored = deserializeExplorationState(serializeExplorationState(moved), map);

    expect(restored).toEqual(moved);
    expect(restored).not.toBe(moved);
    expect(restored.exploredCellIds).not.toBe(moved.exploredCellIds);
  });

  it("rejects malformed saves and saves from another generated map", () => {
    const map = createAbderaRegionMap(101);
    const state = createExplorationState(map);
    const otherMap = createAbderaRegionMap(102);

    expect(() => deserializeExplorationState("not-json", map)).toThrow(/malformed JSON/);
    expect(() => deserializeExplorationState(serializeExplorationState(state), otherMap)).toThrow(/different map/);

    const invalid = { ...state, visitedCellIds: ["unknown-cell"] };
    expect(() => deserializeExplorationState(JSON.stringify(invalid), map)).toThrow(/unknown cell/);
  });
});
