import "./ui/journey.css";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import {
  ROAD_ENCOUNTER_DEFEAT,
  ROAD_ENCOUNTER_NAMED,
  ROAD_ENCOUNTER_OPENING,
  ROAD_ENCOUNTER_PAID,
  ROAD_ENCOUNTER_SEEN,
  ROAD_ENCOUNTER_VICTORY,
  ROAD_ENCOUNTER_WITHDREW,
  type EncounterDialogue,
  type RoadEncounterOutcome,
} from "./content/abderaEncounter";
import {
  createCombatEncounter,
  resolveCombatRound,
  type CombatActionKind,
  type CombatIntent,
  type CombatState,
} from "./sim/combat";
import {
  createAbderaRegionMap,
  createExplorationState,
  deserializeExplorationState,
  getCell,
  moveParty,
  serializeExplorationState,
  type ExplorationState,
} from "./sim/exploration";
import type { HeroId } from "./sim/types";
import {
  mountJourneyHud,
  type CombatHudState,
  type JourneyDialogue,
  type JourneyHudModel,
  type JourneyMode,
} from "./ui/journeyHud";
import { JourneySaveStore } from "./ui/journeySave";
import { buildAbderaWorld, abderaGroundHeight, type AbderaLandmarkAnchor } from "./view/abderaWorld";
import { createGameEngine } from "./view/engine";
import { enableHavok } from "./view/havok";
import { createInput } from "./view/input";
import {
  addActorShadows,
  animateIdleActors,
  createRoadGuards,
  createTravelParty,
  stepTravelParty,
  triggerAttack,
  type TravelActor,
} from "./view/travelActors";

const MAP_SEED = 0x0abde430;
const SAVE_SLOT = "abdera-iteration-02";

interface JourneyFlags {
  roadEncounter: RoadEncounterOutcome;
  learnedPheronName: boolean;
  sharedBread: boolean;
  sparedRoadGuards: boolean;
  lostSilver: boolean;
  bruised: boolean;
}

interface JourneySavePayload {
  exploration: string;
  leader: HeroId;
  kleon: { x: number; z: number };
  ariston: { x: number; z: number };
  stamina: number;
  composure: number;
  flags: JourneyFlags;
  objective: string;
}

interface RuntimeState {
  mode: JourneyMode;
  leader: HeroId;
  exploration: ExplorationState;
  dialogue: EncounterDialogue | null;
  combat: CombatState | null;
  flags: JourneyFlags;
  stamina: number;
  composure: number;
  objective: string;
  location: string;
  interaction: AbderaLandmarkAnchor | null;
  toast: string;
  whisper: string;
}

const LANDMARK_DIALOGUES: Record<string, EncounterDialogue> = {
  "abdera-polis": {
    eyebrow: "МЕСТО · АБДЕРА",
    title: "Город остаётся за спиной",
    lines: [
      "Стена скрывает рынок, школу и людей, которые уже объяснили ваш уход каждый по-своему.",
      "Клеон: «Дом делает человека собой». Аристон: «Иногда. А иногда только мешает увидеть, кем он стал». Восточная дорога начинается у ворот, но не принадлежит им.",
    ],
    choices: [{ id: "close-landmark", label: "Вернуться на дорогу" }],
  },
  "east-road-marker": {
    eyebrow: "МЕСТО · ВОСТОЧНАЯ ДОРОГА",
    title: "Первое настоящее направление",
    lines: [
      "На камне две почти стёртые метки: к побережью и к царской дороге. Обе ведут на восток, но обещают разные виды зависимости.",
      "Это граница нынешнего участка. Следующая итерация превратит выбор направления в переход между регионами.",
    ],
    choices: [{ id: "close-landmark", label: "Запомнить развилку" }],
  },
  "thracian-lookout": {
    eyebrow: "МЕСТО · ВЫСОТА",
    title: "Карта становится меньше мира",
    lines: [
      "С высоты видно море, стены Абдеры и несколько дорог, которых на вашей карте ещё нет. Туман скрывает не пустоту, а чужие намерения.",
      "Аристон: «Не путай открытое место с понятым». Радиус внимания расширяется, но уверенность — нет.",
    ],
    choices: [{ id: "close-landmark", label: "Спуститься" }],
  },
  "abdera-harbor": {
    eyebrow: "МЕСТО · ЭГЕЙСКОЕ МОРЕ",
    title: "Путь, который не держит следов",
    lines: [
      "Мачты в гавани выглядят тонкими на фоне воды. По морю можно выиграть недели и потерять право выбирать берег.",
      "Клеон уже смотрит на корабли. Аристон сначала считает бурдюки с водой. Оба способа видеть понадобятся позже.",
    ],
    choices: [{ id: "close-landmark", label: "Вернуться к береговой дороге" }],
  },
};

function emptyFlags(): JourneyFlags {
  return {
    roadEncounter: "unresolved",
    learnedPheronName: false,
    sharedBread: false,
    sparedRoadGuards: false,
    lostSilver: false,
    bruised: false,
  };
}

function asJourneyDialogue(dialogue: EncounterDialogue | null): JourneyDialogue | null {
  return dialogue;
}

function distanceLabel(distance: CombatState["distance"]): string {
  if (distance === "close") return "вплотную";
  if (distance === "reach") return "дистанция копья";
  return "разрыв";
}

function percent(current: number, maximum: number): number {
  return maximum <= 0 ? 0 : Math.round(current / maximum * 100);
}

function activeCombatants<T extends { status: string }>(items: readonly T[]): T[] {
  return items.filter((item) => item.status === "active");
}

function combatHud(state: CombatState | null, leader: HeroId): CombatHudState | null {
  if (!state) return null;
  const heroes = activeCombatants(state.heroes);
  const enemies = activeCombatants(state.enemies);
  const activeHero = heroes.find((hero) => hero.id === leader) ?? heroes[0] ?? state.heroes[0];
  const heroResolve = heroes.reduce((sum, hero) => sum + hero.composure, 0);
  const heroResolveMax = heroes.reduce((sum, hero) => sum + hero.maxComposure, 0);
  const enemyResolve = enemies.reduce((sum, enemy) => sum + enemy.composure, 0);
  const enemyResolveMax = enemies.reduce((sum, enemy) => sum + enemy.maxComposure, 0);
  const enemyStamina = enemies.reduce((sum, enemy) => sum + enemy.stamina, 0);
  const canStrike = state.distance !== "far" && activeHero.stamina >= 2;
  return {
    round: state.round + 1,
    activeName: activeHero.name,
    heroResolve: percent(heroResolve, heroResolveMax),
    heroStamina: activeHero.stamina,
    enemyResolve: percent(enemyResolve, enemyResolveMax),
    enemyStamina,
    distance: distanceLabel(state.distance),
    log: state.log.map((entry) => entry.text),
    actions: [
      { id: "attack", label: "Ударить древком", note: "2 выносливости · нелетально", disabled: !canStrike },
      { id: "guard", label: "Держать линию", note: "защита и +1 самообладание" },
      { id: "dodge", label: "Уйти с линии", note: "2 выносливости · труднее попасть" },
      { id: "steady", label: "Вернуть дыхание", note: "+3 выносливости · +2 самообладания" },
      { id: "advance", label: "Сократить дистанцию", note: "1 выносливость", disabled: state.distance === "close" },
      { id: "withdraw", label: "Разорвать дистанцию", note: "отход возможен, когда есть разрыв" },
    ],
  };
}

function bootError(error: unknown): void {
  console.error(error);
  const root = document.getElementById("ui-root");
  if (root) {
    root.innerHTML = `<div style="padding:24px;color:#f5ddbd;background:#15100d;font:16px/1.5 system-ui">Игра не запустилась.<br><small></small></div>`;
    const small = root.querySelector("small");
    if (small) small.textContent = error instanceof Error ? error.message : String(error);
  }
}

async function boot(): Promise<void> {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  canvas.tabIndex = 0;
  const qaParams = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null;
  const { engine, backend } = await createGameEngine(canvas, {
    forceWebGL2: qaParams?.get("renderer") === "webgl2",
  });
  engine.setHardwareScalingLevel(Math.max(1, (window.devicePixelRatio || 1) / 1.65));
  const scene = new Scene(engine);
  // Start directly behind the pair and look east along the road. The earlier
  // oblique angle put the camera inside Abdera's southern wall.
  const camera = new ArcRotateCamera("travel-camera", Math.PI, 1.05, 11.5, new Vector3(-2, 1.9, 0), scene);
  camera.lowerRadiusLimit = 7.5;
  camera.upperRadiusLimit = 24;
  camera.lowerBetaLimit = 0.62;
  camera.upperBetaLimit = 1.34;
  camera.wheelPrecision = 36;
  camera.panningSensibility = 0;
  camera.inertia = 0.76;
  camera.minZ = 0.08;
  camera.attachControl(canvas, true);
  camera.keysUp = [];
  camera.keysDown = [];
  camera.keysLeft = [];
  camera.keysRight = [];
  scene.activeCamera = camera;

  const havok = await enableHavok(scene);
  const world = buildAbderaWorld(scene, camera);
  const shrine = world.landmarks.find((landmark) => landmark.id === "road-shrine");
  if (!shrine) throw new Error("В мире нет дорожного святилища");
  const qaSpawn = qaParams?.get("spawn") === "road-shrine"
    ? new Vector3(shrine.position.x - 5.5, abderaGroundHeight(shrine.position.x - 5.5, shrine.position.z), shrine.position.z)
    : world.spawn;
  const party = createTravelParty(scene, qaSpawn);
  for (const hero of [party.kleon, party.ariston]) {
    addActorShadows(hero, (mesh) => world.shadow.addShadowCaster(mesh));
  }
  const guards = createRoadGuards(scene, shrine.position);
  for (const guard of guards) addActorShadows(guard, (mesh) => world.shadow.addShadowCaster(mesh));

  const map = createAbderaRegionMap(MAP_SEED);
  const input = createInput(window);
  const saveStore = new JourneySaveStore<JourneySavePayload>();
  const runtime: RuntimeState = {
    mode: "intro",
    leader: "kleon",
    exploration: createExplorationState(map, { revealRadius: 0 }),
    dialogue: null,
    combat: null,
    flags: emptyFlags(),
    stamina: 100,
    composure: 88,
    objective: "Исследуйте окрестности Абдеры и найдите восточную дорогу",
    location: "За восточными воротами Абдеры",
    interaction: null,
    toast: "",
    whisper: "",
  };

  let fps = 60;
  let lastFpsUpdate = 0;
  let lastExploreCheck = 0;
  let whisperUntil = 0;
  let toastTimer = 0;
  let lastInteractionId: string | null = null;

  const hud = mountJourneyHud(document.getElementById("ui-root")!, {
    onStart() {
      runtime.mode = "travel";
      speak("Неизвестное начинается не там, где кончается карта, а там, где она перестаёт притворяться миром.", 6200);
      canvas.focus();
      paint();
    },
    onSwitchLeader() {
      if (runtime.mode !== "travel") return;
      runtime.leader = runtime.leader === "kleon" ? "ariston" : "kleon";
      toast(`${runtime.leader === "kleon" ? "Клеон" : "Аристон"} ведёт`);
      paint();
    },
    onInteract() {
      beginInteraction();
    },
    onDialogueChoice(id) {
      chooseDialogue(id);
    },
    onCombatAction(action) {
      chooseCombatAction(action);
    },
    async onSave() {
      if (runtime.mode === "combat") {
        toast("Закончите ход, прежде чем записывать путь");
        return;
      }
      await saveStore.write(SAVE_SLOT, {
        exploration: serializeExplorationState(runtime.exploration),
        leader: runtime.leader,
        kleon: { x: party.kleon.root.position.x, z: party.kleon.root.position.z },
        ariston: { x: party.ariston.root.position.x, z: party.ariston.root.position.z },
        stamina: runtime.stamina,
        composure: runtime.composure,
        flags: structuredClone(runtime.flags),
        objective: runtime.objective,
      });
      toast("Путь записан в этом браузере");
    },
    async onLoad() {
      const record = await saveStore.read(SAVE_SLOT);
      if (!record) {
        toast("Записи этой итерации ещё нет");
        return;
      }
      try {
        const payload = record.payload;
        runtime.exploration = deserializeExplorationState(payload.exploration, map);
        runtime.leader = payload.leader;
        runtime.stamina = payload.stamina;
        runtime.composure = payload.composure;
        runtime.flags = structuredClone(payload.flags);
        runtime.objective = payload.objective;
        runtime.location = locationNameForCell(runtime.exploration.partyCellId);
        for (const [actor, point] of [[party.kleon, payload.kleon], [party.ariston, payload.ariston]] as const) {
          actor.root.position.set(point.x, abderaGroundHeight(point.x, point.z), point.z);
          actor.velocity.setAll(0);
        }
        runtime.mode = "travel";
        runtime.dialogue = null;
        runtime.combat = null;
        syncGuards();
        toast("Вернулись к записи");
        paint();
      } catch (error) {
        console.warn("Save rejected", error);
        toast("Запись несовместима с этой картой");
      }
    },
  });

  function speak(text: string, duration = 4200): void {
    runtime.whisper = text;
    whisperUntil = performance.now() + duration;
  }

  function toast(text: string, duration = 2500): void {
    runtime.toast = text;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      runtime.toast = "";
      paint();
    }, duration);
    paint();
  }

  function nearestLandmark(position: Vector3): AbderaLandmarkAnchor | null {
    let best: AbderaLandmarkAnchor | null = null;
    let distance = Infinity;
    for (const landmark of world.landmarks) {
      const planar = Math.hypot(position.x - landmark.position.x, position.z - landmark.position.z);
      if (planar < landmark.interactionRadius && planar < distance) {
        if (landmark.id === "road-shrine" && runtime.flags.roadEncounter !== "unresolved" && runtime.flags.roadEncounter !== "withdrew") continue;
        best = landmark;
        distance = planar;
      }
    }
    return best;
  }

  function beginInteraction(): void {
    if (runtime.mode !== "travel" || !runtime.interaction) return;
    if (runtime.interaction.id === "road-shrine") {
      runtime.mode = "dialogue";
      runtime.dialogue = ROAD_ENCOUNTER_OPENING;
    } else {
      runtime.mode = "dialogue";
      runtime.dialogue = LANDMARK_DIALOGUES[runtime.interaction.id] ?? {
        eyebrow: "ОТКРЫТОЕ МЕСТО",
        title: runtime.interaction.title,
        lines: [runtime.interaction.description],
        choices: [{ id: "close-landmark", label: "Продолжить путь" }],
      };
    }
    paint();
  }

  function chooseDialogue(id: string): void {
    if (id === "look") {
      runtime.dialogue = ROAD_ENCOUNTER_SEEN;
    } else if (id === "name") {
      runtime.flags.roadEncounter = "named";
      runtime.flags.learnedPheronName = true;
      runtime.dialogue = ROAD_ENCOUNTER_NAMED;
      runtime.mode = "aftermath";
      runtime.objective = "Исследуйте тёмные места карты или дойдите до восточного межевого камня";
    } else if (id === "share_bread") {
      runtime.flags.roadEncounter = "paid";
      runtime.flags.sharedBread = true;
      runtime.stamina = Math.max(0, runtime.stamina - 14);
      runtime.dialogue = ROAD_ENCOUNTER_PAID;
      runtime.mode = "aftermath";
      runtime.objective = "Исследуйте тёмные места карты или дойдите до восточного межевого камня";
    } else if (id === "withdraw") {
      runtime.flags.roadEncounter = "withdrew";
      runtime.dialogue = ROAD_ENCOUNTER_WITHDREW;
      runtime.mode = "aftermath";
    } else if (id === "fight") {
      startCombat();
    } else if (id === "continue" || id === "close-landmark") {
      runtime.mode = "travel";
      runtime.dialogue = null;
      syncGuards();
      canvas.focus();
    }
    paint();
  }

  function startCombat(): void {
    runtime.combat = createCombatEncounter({
      seed: MAP_SEED ^ runtime.exploration.travelCount ^ 0x431,
      distance: "reach",
      heroForce: "nonlethal",
      enemyForce: "nonlethal",
      maxRounds: 7,
      heroes: [
        { id: "kleon", name: "Клеон", power: 3, maxStamina: 7, maxComposure: 6 },
        { id: "ariston", name: "Аристон", power: 4, maxStamina: 8, maxComposure: 5 },
      ],
      enemies: [
        { id: "road-guard-0", name: "Ферон", power: 3, maxStamina: 6, maxComposure: 4 },
        { id: "road-guard-1", name: "Младший копейщик", power: 2, maxStamina: 5, maxComposure: 3 },
        { id: "road-guard-2", name: "Смотрящий назад", power: 2, maxStamina: 5, maxComposure: 3 },
      ],
    });
    runtime.mode = "combat";
    runtime.dialogue = null;
  }

  function companionIntent(action: CombatActionKind, state: CombatState, actingHeroId: string): CombatIntent | null {
    const companion = activeCombatants(state.heroes).find((hero) => hero.id !== actingHeroId);
    if (!companion) return null;
    const target = activeCombatants(state.enemies)[0];
    if (state.distance === "far") return { actorId: companion.id, action: "advance" };
    if (companion.stamina <= 1) return { actorId: companion.id, action: "steady" };
    if (action === "attack") return { actorId: companion.id, action: "guard" };
    if (action === "withdraw") return { actorId: companion.id, action: "withdraw" };
    return { actorId: companion.id, action: "attack", targetId: target?.id, force: "nonlethal" };
  }

  function chooseCombatAction(action: CombatActionKind): void {
    const state = runtime.combat;
    if (!state || state.phase !== "active") return;
    const actingHero = activeCombatants(state.heroes).find((hero) => hero.id === runtime.leader)
      ?? activeCombatants(state.heroes)[0];
    if (!actingHero) return;
    const target = activeCombatants(state.enemies)[0];
    const leaderIntent: CombatIntent = {
      actorId: actingHero.id,
      action,
      targetId: action === "attack" ? target?.id : undefined,
      force: action === "attack" ? "nonlethal" : undefined,
    };
    const companion = companionIntent(action, state, actingHero.id);
    const resolution = resolveCombatRound(state, companion ? [leaderIntent, companion] : [leaderIntent]);
    runtime.combat = resolution.state;
    for (const entry of resolution.entries) {
      if (entry.action !== "attack" || !entry.actorId) continue;
      const actor = actorById(entry.actorId);
      if (actor) triggerAttack(actor);
    }
    syncGuardCombatState();
    if (resolution.outcome) {
      const standingHeroes = activeCombatants(resolution.state.heroes);
      runtime.stamina = Math.max(20, Math.round(
        standingHeroes.reduce((sum, hero) => sum + hero.stamina, 0) /
        Math.max(1, standingHeroes.length) / 8 * 100,
      ));
      runtime.composure = Math.max(16, Math.round(
        resolution.state.heroes.reduce((sum, hero) => sum + hero.composure, 0) /
        resolution.state.heroes.reduce((sum, hero) => sum + hero.maxComposure, 0) * 100,
      ));
      if (resolution.outcome.kind === "victory") {
        runtime.flags.roadEncounter = "fought";
        runtime.flags.sparedRoadGuards = !resolution.outcome.consequences.some((item) => item.kind === "death");
        runtime.dialogue = ROAD_ENCOUNTER_VICTORY;
      } else if (resolution.outcome.kind === "withdrawal") {
        runtime.flags.roadEncounter = "withdrew";
        runtime.dialogue = ROAD_ENCOUNTER_WITHDREW;
      } else {
        runtime.flags.roadEncounter = "defeated";
        runtime.flags.lostSilver = true;
        runtime.flags.bruised = true;
        runtime.dialogue = ROAD_ENCOUNTER_DEFEAT;
      }
      runtime.mode = "aftermath";
      runtime.objective = "Продолжайте исследовать регион: поражение и победа одинаково меняют дорогу";
    }
    paint();
  }

  function actorById(id: string): TravelActor | undefined {
    if (id === "kleon") return party.kleon;
    if (id === "ariston") return party.ariston;
    return guards.find((guard) => guard.id === id);
  }

  function syncGuardCombatState(): void {
    if (!runtime.combat) return;
    for (const guard of guards) {
      const state = runtime.combat.enemies.find((enemy) => enemy.id === guard.id);
      if (!state) continue;
      guard.root.setEnabled(state.status === "active");
    }
  }

  function syncGuards(): void {
    const present = runtime.flags.roadEncounter === "unresolved" || runtime.flags.roadEncounter === "withdrew";
    for (const guard of guards) guard.root.setEnabled(present);
  }

  function updateExploration(now: number, leaderPosition: Vector3): void {
    if (now - lastExploreCheck < 180) return;
    lastExploreCheck = now;
    const current = getCell(map, runtime.exploration.partyCellId);
    if (!current) return;
    const candidates = map.cells
      .filter((cell) => cell.passable && (cell.id === current.id || current.neighborIds.includes(cell.id)))
      .map((cell) => ({
        cell,
        distance: Math.hypot(leaderPosition.x - cell.worldPosition.x, leaderPosition.z - cell.worldPosition.z),
      }))
      .sort((a, b) => a.distance - b.distance);
    const nearest = candidates[0];
    if (!nearest || nearest.cell.id === current.id) return;
    const result = moveParty(map, runtime.exploration, nearest.cell.id);
    runtime.exploration = result.state;
    const discovered = result.movement.newlyDiscoveredLandmarkIds[0];
    if (discovered) {
      const landmark = map.landmarks.find((item) => item.id === discovered);
      if (landmark) toast(`Открыто место: ${landmark.name}`);
    } else if (result.movement.newlyExploredCellIds.length > 0) {
      speak("Карта запоминает пройденное, но ничего не обещает о следующем шаге.", 3200);
    }
    const cellLandmark = map.landmarks.find((item) => item.cellId === nearest.cell.id);
    runtime.location = cellLandmark?.name ?? terrainName(nearest.cell.terrain);
    paint();
  }

  function terrainName(terrain: string): string {
    const names: Record<string, string> = {
      polis: "Окрестности Абдеры",
      road: "Восточная дорога",
      coastal_plain: "Фракийская равнина",
      scrub: "Сухой кустарник",
      marsh: "Прибрежные топи",
      hills: "Фракийские высоты",
      ford: "Брод через Нест",
      river: "Река Нест",
      shore: "Берег Эгейского моря",
      sea: "Эгейское море",
    };
    return names[terrain] ?? "Неизвестное место";
  }

  function locationNameForCell(cellId: string): string {
    const cell = getCell(map, cellId);
    if (!cell) return "Неизвестное место";
    const landmark = map.landmarks.find((item) => item.cellId === cell.id);
    return landmark?.name ?? terrainName(cell.terrain);
  }

  function paint(): void {
    const model: JourneyHudModel = {
      mode: runtime.mode,
      backend,
      havok: havok.ok,
      fps,
      leader: runtime.leader,
      objective: runtime.objective,
      location: runtime.location,
      yearLabel: map.epoch.label,
      stamina: runtime.stamina,
      composure: runtime.composure,
      whisper: runtime.whisper,
      interactionPrompt: runtime.interaction ? runtime.interaction.title : null,
      toast: runtime.toast,
      map,
      exploration: runtime.exploration,
      dialogue: asJourneyDialogue(runtime.dialogue),
      combat: combatHud(runtime.combat, runtime.leader),
    };
    hud.render(model);
  }

  paint();
  window.addEventListener("resize", () => {
    engine.resize();
    paint();
  });

  engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
    const sample = input.sample();

    if (sample.toggleMap && runtime.mode === "travel") {
      hud.toggleMap();
      paint();
    }
    if (sample.cancel && hud.isMapOpen()) {
      hud.toggleMap(false);
      paint();
    }
    if (sample.switchLeader && runtime.mode === "travel" && !hud.isMapOpen()) {
      runtime.leader = runtime.leader === "kleon" ? "ariston" : "kleon";
      toast(`${runtime.leader === "kleon" ? "Клеон" : "Аристон"} ведёт`);
    }

    const cameraForward = camera.getTarget().subtract(camera.position);
    cameraForward.y = 0;
    if (cameraForward.lengthSquared() < 0.001) cameraForward.set(0, 0, 1);
    cameraForward.normalize();
    const cameraRight = new Vector3(-cameraForward.z, 0, cameraForward.x);
    const wish = cameraForward.scale(sample.forward).add(cameraRight.scale(sample.strafe));
    if (wish.lengthSquared() > 1) wish.normalize();
    const blocked = runtime.mode !== "travel" || hud.isMapOpen();
    const canSprint = sample.sprint && runtime.stamina > 0;
    const stepped = stepTravelParty(
      party,
      runtime.leader,
      { ...sample, sprint: canSprint },
      wish,
      dt,
      abderaGroundHeight,
      blocked,
    );
    animateIdleActors(guards.filter((guard) => guard.root.isEnabled()), dt);

    if (!blocked && stepped.moved && canSprint) {
      runtime.stamina = Math.max(0, runtime.stamina - dt * 7.5);
    } else if (runtime.mode === "travel") {
      runtime.stamina = Math.min(100, runtime.stamina + dt * 4.2);
    }

    const lookAt = party.kleon.root.position.add(party.ariston.root.position).scale(0.5).add(new Vector3(0, 1.35, 0));
    camera.setTarget(Vector3.Lerp(camera.getTarget(), lookAt, 1 - Math.pow(0.025, dt * 60)));

    if (runtime.mode === "travel" && !hud.isMapOpen()) {
      updateExploration(now, stepped.leader.root.position);
      const interaction = nearestLandmark(stepped.leader.root.position);
      runtime.interaction = interaction;
      const interactionId = interaction?.id ?? null;
      if (interactionId !== lastInteractionId) {
        lastInteractionId = interactionId;
        paint();
      }
      if (sample.interact) beginInteraction();
    }

    if (runtime.whisper && now > whisperUntil) {
      runtime.whisper = "";
      whisperUntil = 0;
      paint();
    }
    if (now - lastFpsUpdate > 900) {
      fps = engine.getFps();
      lastFpsUpdate = now;
      paint();
    }

    scene.render();
  });
}

boot().catch(bootError);
