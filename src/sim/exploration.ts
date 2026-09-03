/**
 * Pure, serializable world-exploration state.
 *
 * This module deliberately has no renderer or storage dependencies. A UI can use
 * axial coordinates for a flat map, while a 3D view can consume worldPosition.
 */

export const EXPLORATION_STATE_VERSION = 1 as const;
export const ABDERA_REGION_ID = "thrace-abdera" as const;
export const DEFAULT_ABDERA_SEED = 0x0abde430;

export type CellId = string;
export type LandmarkId = string;
export type RegionId = string;

export interface AxialCoordinate {
  q: number;
  r: number;
}

export interface WorldPosition {
  x: number;
  y: number;
  z: number;
}

export type TerrainKind =
  | "polis"
  | "road"
  | "coastal_plain"
  | "scrub"
  | "marsh"
  | "hills"
  | "ford"
  | "river"
  | "shore"
  | "sea";

export type LandmarkKind = "polis" | "harbor" | "ford" | "road_marker" | "lookout" | "shrine";

export interface WorldCell {
  id: CellId;
  coordinate: AxialCoordinate;
  /** Renderer-neutral local position in the region, in metres. */
  worldPosition: WorldPosition;
  terrain: TerrainKind;
  biomeTags: string[];
  passable: boolean;
  /** Null means that the party cannot enter the cell on foot. */
  movementCost: number | null;
  /** Stable visual variant (0-3), derived from the map seed. */
  surfaceVariant: number;
  neighborIds: CellId[];
  landmarkIds: LandmarkId[];
}

export interface WorldLandmark {
  id: LandmarkId;
  cellId: CellId;
  kind: LandmarkKind;
  name: string;
  description: string;
}

export interface RegionMap {
  version: 1;
  id: string;
  seed: number;
  regionId: RegionId;
  name: string;
  epoch: {
    yearBce: number;
    label: string;
    context: string;
  };
  grid: {
    kind: "pointy-hex";
    radius: number;
    hexSize: number;
  };
  startCellId: CellId;
  cells: WorldCell[];
  landmarks: WorldLandmark[];
}

export interface ExplorationState {
  version: 1;
  mapId: string;
  regionId: RegionId;
  partyCellId: CellId;
  revealRadius: number;
  /** Every cell that has ever emerged from the fog. */
  exploredCellIds: CellId[];
  /** Cells currently in the party's sight radius. */
  visibleCellIds: CellId[];
  /** Cells on which the party has actually stood. */
  visitedCellIds: CellId[];
  discoveredLandmarkIds: LandmarkId[];
  travelCount: number;
}

export type CellFog = "hidden" | "explored" | "visible";

export interface CellKnowledge {
  fog: CellFog;
  visited: boolean;
}

export interface TravelOption {
  cellId: CellId;
  movementCost: number;
  worldPosition: WorldPosition;
  terrain: TerrainKind;
  explored: boolean;
  visited: boolean;
}

export interface MovePartyResult {
  state: ExplorationState;
  movement: {
    fromCellId: CellId;
    toCellId: CellId;
    fromWorldPosition: WorldPosition;
    toWorldPosition: WorldPosition;
    movementCost: number;
    newlyExploredCellIds: CellId[];
    newlyDiscoveredLandmarkIds: LandmarkId[];
  };
}

interface LandmarkBlueprint extends Omit<WorldLandmark, "cellId"> {
  coordinate: AxialCoordinate;
}

const HEX_RADIUS = 3;
const HEX_SIZE = 24;

const HEX_DIRECTIONS: ReadonlyArray<AxialCoordinate> = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

const LANDMARK_BLUEPRINTS: ReadonlyArray<LandmarkBlueprint> = [
  {
    id: "abdera-polis",
    kind: "polis",
    name: "Абдера",
    description: "Фракийский полис у Эгейского моря; здесь начинается путь на восток.",
    coordinate: { q: 0, r: 0 },
  },
  {
    id: "abdera-harbor",
    kind: "harbor",
    name: "Гавань Абдеры",
    description: "Береговая гавань, откуда путь может продолжиться морем.",
    coordinate: { q: 0, r: 2 },
  },
  {
    id: "nestos-ford",
    kind: "ford",
    name: "Брод через Нестос",
    description: "Неглубокое место западнее Абдеры, заметное по камням в течении.",
    coordinate: { q: -2, r: 0 },
  },
  {
    id: "east-road-marker",
    kind: "road_marker",
    name: "Восточный межевой камень",
    description: "Камень у дороги, уходящей от полиса вдоль фракийского берега.",
    coordinate: { q: 2, r: 0 },
  },
  {
    id: "road-shrine",
    kind: "shrine",
    name: "Разорённое святилище",
    description: "Небольшое дорожное святилище, у которого давно не спрашивали разрешения брать пошлину.",
    coordinate: { q: 2, r: -1 },
  },
  {
    id: "thracian-lookout",
    kind: "lookout",
    name: "Высота над равниной",
    description: "Открытая высота, с которой видны берег, река и дорога.",
    coordinate: { q: 1, r: -2 },
  },
];

export function cellIdAt(coordinate: AxialCoordinate): CellId {
  return `${coordinate.q},${coordinate.r}`;
}

export function hexDistance(a: AxialCoordinate, b: AxialCoordinate): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function axialToWorld(coordinate: AxialCoordinate, hexSize = HEX_SIZE, elevation = 0): WorldPosition {
  return {
    x: hexSize * Math.sqrt(3) * (coordinate.q + coordinate.r / 2),
    y: elevation,
    z: hexSize * 1.5 * coordinate.r,
  };
}

/** Builds the first authored macro-region. The seed changes only local surface variation. */
export function createAbderaRegionMap(seed = DEFAULT_ABDERA_SEED): RegionMap {
  const normalizedSeed = seed >>> 0;
  const coordinates = enumerateHex(HEX_RADIUS);
  const coordinateIds = new Set(coordinates.map(cellIdAt));

  const landmarks: WorldLandmark[] = LANDMARK_BLUEPRINTS.map(({ coordinate, ...landmark }) => ({
    ...landmark,
    cellId: cellIdAt(coordinate),
  }));

  const landmarksByCell = new Map<CellId, LandmarkId[]>();
  for (const landmark of landmarks) {
    const current = landmarksByCell.get(landmark.cellId) ?? [];
    current.push(landmark.id);
    landmarksByCell.set(landmark.cellId, current);
  }

  const cells = coordinates.map((coordinate): WorldCell => {
    const id = cellIdAt(coordinate);
    const terrain = terrainAt(coordinate, normalizedSeed);
    const movementCost = movementCostFor(terrain);
    const variantNoise = coordinateNoise(normalizedSeed, coordinate);
    const worldPosition = axialToWorld(
      coordinate,
      HEX_SIZE,
      baseElevationFor(terrain) + (variantNoise - 0.5) * elevationVariationFor(terrain),
    );

    return {
      id,
      coordinate: { ...coordinate },
      worldPosition,
      terrain,
      biomeTags: biomeTagsFor(terrain),
      passable: movementCost !== null,
      movementCost,
      surfaceVariant: Math.min(3, Math.floor(variantNoise * 4)),
      neighborIds: HEX_DIRECTIONS.map((direction) =>
        cellIdAt({ q: coordinate.q + direction.q, r: coordinate.r + direction.r }),
      ).filter((neighborId) => coordinateIds.has(neighborId)),
      landmarkIds: [...(landmarksByCell.get(id) ?? [])],
    };
  });

  return {
    version: 1,
    id: `${ABDERA_REGION_ID}:${normalizedSeed.toString(16).padStart(8, "0")}`,
    seed: normalizedSeed,
    regionId: ABDERA_REGION_ID,
    name: "Фракийский берег и Абдера",
    epoch: {
      yearBce: 430,
      label: "Около 430 года до н. э.",
      context: "Эпоха Демокрита, до походов Александра Македонского",
    },
    grid: {
      kind: "pointy-hex",
      radius: HEX_RADIUS,
      hexSize: HEX_SIZE,
    },
    startCellId: cellIdAt({ q: 0, r: 0 }),
    cells,
    landmarks,
  };
}

export function createExplorationState(
  map: RegionMap,
  options: { startCellId?: CellId; revealRadius?: number } = {},
): ExplorationState {
  const startCellId = options.startCellId ?? map.startCellId;
  const revealRadius = options.revealRadius ?? 1;
  assertRadius(revealRadius);
  const start = requireCell(map, startCellId);
  if (!start.passable) {
    throw new Error(`Cannot place party on impassable cell: ${startCellId}`);
  }

  const initial: ExplorationState = {
    version: EXPLORATION_STATE_VERSION,
    mapId: map.id,
    regionId: map.regionId,
    partyCellId: startCellId,
    revealRadius,
    exploredCellIds: [],
    visibleCellIds: [],
    visitedCellIds: [startCellId],
    discoveredLandmarkIds: [],
    travelCount: 0,
  };

  return revealAroundParty(map, initial);
}

/** Recomputes current visibility and permanently remembers everything it exposes. */
export function revealAroundParty(map: RegionMap, state: ExplorationState): ExplorationState {
  assertCompatibleMap(map, state);
  assertRadius(state.revealRadius);
  const partyCell = requireCell(map, state.partyCellId);
  const visibleCellIds = map.cells
    .filter((cell) => hexDistance(cell.coordinate, partyCell.coordinate) <= state.revealRadius)
    .map((cell) => cell.id);
  const visibleSet = new Set(visibleCellIds);
  const exploredCellIds = orderedCellUnion(map, state.exploredCellIds, visibleCellIds);
  const newlyVisibleLandmarkIds = map.landmarks
    .filter((landmark) => visibleSet.has(landmark.cellId))
    .map((landmark) => landmark.id);

  return {
    ...state,
    visibleCellIds,
    exploredCellIds,
    discoveredLandmarkIds: orderedLandmarkUnion(map, state.discoveredLandmarkIds, newlyVisibleLandmarkIds),
  };
}

/** Changes the party's sight radius and immediately refreshes fog-of-war. */
export function setRevealRadius(map: RegionMap, state: ExplorationState, revealRadius: number): ExplorationState {
  assertRadius(revealRadius);
  return revealAroundParty(map, { ...state, revealRadius });
}

export function getTravelOptions(map: RegionMap, state: ExplorationState): TravelOption[] {
  assertCompatibleMap(map, state);
  const current = requireCell(map, state.partyCellId);
  const explored = new Set(state.exploredCellIds);
  const visited = new Set(state.visitedCellIds);

  return current.neighborIds
    .map((id) => requireCell(map, id))
    .filter((cell): cell is WorldCell & { movementCost: number } => cell.passable && cell.movementCost !== null)
    .map((cell) => ({
      cellId: cell.id,
      movementCost: cell.movementCost,
      worldPosition: { ...cell.worldPosition },
      terrain: cell.terrain,
      explored: explored.has(cell.id),
      visited: visited.has(cell.id),
    }));
}

/** Performs one adjacent on-foot move and returns animation/discovery metadata. */
export function moveParty(map: RegionMap, state: ExplorationState, toCellId: CellId): MovePartyResult {
  assertCompatibleMap(map, state);
  const from = requireCell(map, state.partyCellId);
  const to = requireCell(map, toCellId);
  if (!from.neighborIds.includes(toCellId)) {
    throw new Error(`Party can only move to an adjacent cell: ${from.id} -> ${toCellId}`);
  }
  if (!to.passable || to.movementCost === null) {
    throw new Error(`Party cannot enter impassable cell: ${toCellId}`);
  }

  const previouslyExplored = new Set(state.exploredCellIds);
  const previouslyDiscovered = new Set(state.discoveredLandmarkIds);
  const moved: ExplorationState = {
    ...state,
    partyCellId: toCellId,
    visitedCellIds: orderedCellUnion(map, state.visitedCellIds, [toCellId]),
    travelCount: state.travelCount + 1,
  };
  const next = revealAroundParty(map, moved);

  return {
    state: next,
    movement: {
      fromCellId: from.id,
      toCellId: to.id,
      fromWorldPosition: { ...from.worldPosition },
      toWorldPosition: { ...to.worldPosition },
      movementCost: to.movementCost,
      newlyExploredCellIds: next.exploredCellIds.filter((id) => !previouslyExplored.has(id)),
      newlyDiscoveredLandmarkIds: next.discoveredLandmarkIds.filter((id) => !previouslyDiscovered.has(id)),
    },
  };
}

export function getCellKnowledge(state: ExplorationState, cellId: CellId): CellKnowledge {
  const visible = state.visibleCellIds.includes(cellId);
  const explored = state.exploredCellIds.includes(cellId);
  return {
    fog: visible ? "visible" : explored ? "explored" : "hidden",
    visited: state.visitedCellIds.includes(cellId),
  };
}

export function getDiscoveredLandmarks(map: RegionMap, state: ExplorationState): WorldLandmark[] {
  assertCompatibleMap(map, state);
  const discovered = new Set(state.discoveredLandmarkIds);
  return map.landmarks.filter((landmark) => discovered.has(landmark.id));
}

export function getCell(map: RegionMap, cellId: CellId): WorldCell | undefined {
  return map.cells.find((cell) => cell.id === cellId);
}

export function serializeExplorationState(state: ExplorationState): string {
  return JSON.stringify(state);
}

export function deserializeExplorationState(serialized: string, map: RegionMap): ExplorationState {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch (error) {
    throw new Error("Invalid exploration save: malformed JSON", { cause: error });
  }

  const state = validateExplorationState(value, map);
  return {
    ...state,
    exploredCellIds: [...state.exploredCellIds],
    visibleCellIds: [...state.visibleCellIds],
    visitedCellIds: [...state.visitedCellIds],
    discoveredLandmarkIds: [...state.discoveredLandmarkIds],
  };
}

function validateExplorationState(value: unknown, map: RegionMap): ExplorationState {
  if (!isRecord(value)) throw new Error("Invalid exploration save: expected an object");
  if (value.version !== EXPLORATION_STATE_VERSION) {
    throw new Error(`Unsupported exploration save version: ${String(value.version)}`);
  }
  if (value.mapId !== map.id || value.regionId !== map.regionId) {
    throw new Error("Exploration save belongs to a different map");
  }
  if (typeof value.partyCellId !== "string") throw new Error("Invalid exploration save: partyCellId");
  if (!Number.isInteger(value.revealRadius) || (value.revealRadius as number) < 0) {
    throw new Error("Invalid exploration save: revealRadius");
  }
  if (!Number.isInteger(value.travelCount) || (value.travelCount as number) < 0) {
    throw new Error("Invalid exploration save: travelCount");
  }

  const exploredCellIds = readUniqueStringArray(value.exploredCellIds, "exploredCellIds");
  const visibleCellIds = readUniqueStringArray(value.visibleCellIds, "visibleCellIds");
  const visitedCellIds = readUniqueStringArray(value.visitedCellIds, "visitedCellIds");
  const discoveredLandmarkIds = readUniqueStringArray(value.discoveredLandmarkIds, "discoveredLandmarkIds");
  const knownCells = new Set(map.cells.map((cell) => cell.id));
  const knownLandmarks = new Set(map.landmarks.map((landmark) => landmark.id));

  assertKnownIds(exploredCellIds, knownCells, "cell");
  assertKnownIds(visibleCellIds, knownCells, "cell");
  assertKnownIds(visitedCellIds, knownCells, "cell");
  assertKnownIds(discoveredLandmarkIds, knownLandmarks, "landmark");
  if (!knownCells.has(value.partyCellId)) throw new Error(`Invalid exploration save: unknown party cell ${value.partyCellId}`);
  if (!requireCell(map, value.partyCellId).passable) {
    throw new Error("Invalid exploration save: party cell is impassable");
  }

  const explored = new Set(exploredCellIds);
  if (visibleCellIds.some((id) => !explored.has(id))) {
    throw new Error("Invalid exploration save: visible cells must be explored");
  }
  if (visitedCellIds.some((id) => !explored.has(id))) {
    throw new Error("Invalid exploration save: visited cells must be explored");
  }
  if (!visitedCellIds.includes(value.partyCellId) || !visibleCellIds.includes(value.partyCellId)) {
    throw new Error("Invalid exploration save: party cell must be visible and visited");
  }
  const landmarkById = new Map(map.landmarks.map((landmark) => [landmark.id, landmark]));
  if (discoveredLandmarkIds.some((id) => !explored.has(landmarkById.get(id)!.cellId))) {
    throw new Error("Invalid exploration save: landmark cell must be explored");
  }

  return {
    version: EXPLORATION_STATE_VERSION,
    mapId: value.mapId,
    regionId: value.regionId,
    partyCellId: value.partyCellId,
    revealRadius: value.revealRadius as number,
    exploredCellIds,
    visibleCellIds,
    visitedCellIds,
    discoveredLandmarkIds,
    travelCount: value.travelCount as number,
  };
}

function enumerateHex(radius: number): AxialCoordinate[] {
  const result: AxialCoordinate[] = [];
  for (let q = -radius; q <= radius; q += 1) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r += 1) result.push({ q, r });
  }
  return result.sort((a, b) => a.r - b.r || a.q - b.q);
}

function terrainAt(coordinate: AxialCoordinate, seed: number): TerrainKind {
  const { q, r } = coordinate;
  if (q === 0 && r === 0) return "polis";
  if (r === 3) return "sea";
  if (q === -2 && r >= -1 && r <= 1) return r === 0 ? "ford" : "river";
  if (r === 2) return "shore";
  if (q >= 1 && r === 0) return "road";
  if (r <= -2) return "hills";
  if (r === 1 && q <= 0) return "marsh";
  return coordinateNoise(seed ^ 0x7f4a7c15, coordinate) > 0.58 ? "scrub" : "coastal_plain";
}

function coordinateNoise(seed: number, coordinate: AxialCoordinate): number {
  let value = seed ^ Math.imul(coordinate.q, 0x1f123bb5) ^ Math.imul(coordinate.r, 0x5f356495);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

function movementCostFor(terrain: TerrainKind): number | null {
  switch (terrain) {
    case "polis":
      return 1;
    case "road":
      return 0.75;
    case "coastal_plain":
      return 1;
    case "scrub":
      return 1.25;
    case "marsh":
      return 1.75;
    case "hills":
      return 1.6;
    case "ford":
      return 1.4;
    case "shore":
      return 1.2;
    case "river":
    case "sea":
      return null;
  }
}

function baseElevationFor(terrain: TerrainKind): number {
  switch (terrain) {
    case "sea":
      return -0.6;
    case "river":
      return -0.25;
    case "ford":
      return -0.05;
    case "shore":
    case "marsh":
      return 0.08;
    case "polis":
    case "road":
    case "coastal_plain":
    case "scrub":
      return 0.4;
    case "hills":
      return 3.2;
  }
}

function elevationVariationFor(terrain: TerrainKind): number {
  return terrain === "hills" ? 2.4 : terrain === "sea" || terrain === "river" ? 0.08 : 0.45;
}

function biomeTagsFor(terrain: TerrainKind): string[] {
  switch (terrain) {
    case "polis":
      return ["urban", "greek-polis", "thrace"];
    case "road":
      return ["road", "coastal", "thrace"];
    case "coastal_plain":
      return ["plain", "coastal", "thrace"];
    case "scrub":
      return ["scrub", "dry", "thrace"];
    case "marsh":
      return ["wetland", "reeds", "coastal"];
    case "hills":
      return ["hills", "rock", "thrace"];
    case "ford":
      return ["river", "ford", "current"];
    case "river":
      return ["river", "current", "deep-water"];
    case "shore":
      return ["shore", "salt", "aegean"];
    case "sea":
      return ["sea", "salt", "aegean"];
  }
}

function orderedCellUnion(map: RegionMap, ...groups: ReadonlyArray<ReadonlyArray<CellId>>): CellId[] {
  const included = new Set(groups.flat());
  return map.cells.filter((cell) => included.has(cell.id)).map((cell) => cell.id);
}

function orderedLandmarkUnion(map: RegionMap, ...groups: ReadonlyArray<ReadonlyArray<LandmarkId>>): LandmarkId[] {
  const included = new Set(groups.flat());
  return map.landmarks.filter((landmark) => included.has(landmark.id)).map((landmark) => landmark.id);
}

function requireCell(map: RegionMap, cellId: CellId): WorldCell {
  const cell = getCell(map, cellId);
  if (!cell) throw new Error(`Unknown map cell: ${cellId}`);
  return cell;
}

function assertCompatibleMap(map: RegionMap, state: ExplorationState): void {
  if (state.mapId !== map.id || state.regionId !== map.regionId) {
    throw new Error("Exploration state belongs to a different map");
  }
  requireCell(map, state.partyCellId);
}

function assertRadius(radius: number): void {
  if (!Number.isInteger(radius) || radius < 0) throw new Error("Reveal radius must be a non-negative integer");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readUniqueStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Invalid exploration save: ${field}`);
  }
  const strings = value as string[];
  if (new Set(strings).size !== strings.length) {
    throw new Error(`Invalid exploration save: duplicate id in ${field}`);
  }
  return [...strings];
}

function assertKnownIds(ids: string[], knownIds: Set<string>, kind: string): void {
  const unknown = ids.find((id) => !knownIds.has(id));
  if (unknown) throw new Error(`Invalid exploration save: unknown ${kind} ${unknown}`);
}
