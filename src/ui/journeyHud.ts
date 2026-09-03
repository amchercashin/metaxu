import type { CombatActionKind } from "../sim/combat";
import {
  getCellKnowledge,
  getDiscoveredLandmarks,
  type ExplorationState,
  type RegionMap,
} from "../sim/exploration";
import type { HeroId } from "../sim/types";

export type JourneyMode = "intro" | "travel" | "dialogue" | "combat" | "aftermath";

export interface JourneyChoice {
  id: string;
  label: string;
  note?: string;
}

export interface JourneyDialogue {
  eyebrow: string;
  title: string;
  lines: string[];
  choices: JourneyChoice[];
}

export interface CombatHudState {
  round: number;
  activeName: string;
  heroResolve: number;
  heroStamina: number;
  enemyResolve: number;
  enemyStamina: number;
  distance: string;
  log: string[];
  actions: Array<{ id: CombatActionKind; label: string; note: string; disabled?: boolean }>;
}

export interface JourneyHudModel {
  mode: JourneyMode;
  backend: "webgpu" | "webgl2";
  havok: boolean;
  fps: number;
  leader: HeroId;
  objective: string;
  location: string;
  yearLabel: string;
  stamina: number;
  composure: number;
  whisper: string;
  interactionPrompt: string | null;
  toast: string;
  map: RegionMap;
  exploration: ExplorationState;
  dialogue: JourneyDialogue | null;
  combat: CombatHudState | null;
}

export interface JourneyHudHandlers {
  onStart(): void;
  onSwitchLeader(): void;
  onInteract(): void;
  onDialogueChoice(id: string): void;
  onCombatAction(action: CombatActionKind): void;
  onSave(): void;
  onLoad(): void;
}

function heroName(id: HeroId): string {
  return id === "kleon" ? "Клеон" : "Аристон";
}

function makeButton(label: string, className: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function drawHex(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
): void {
  context.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = Math.PI / 180 * (60 * i - 30);
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

function terrainColor(terrain: string, visible: boolean): string {
  const alpha = visible ? 0.94 : 0.54;
  const palette: Record<string, string> = {
    polis: `rgba(193, 157, 104, ${alpha})`,
    road: `rgba(157, 111, 68, ${alpha})`,
    coastal_plain: `rgba(116, 122, 76, ${alpha})`,
    scrub: `rgba(93, 103, 62, ${alpha})`,
    marsh: `rgba(57, 90, 78, ${alpha})`,
    hills: `rgba(100, 84, 66, ${alpha})`,
    ford: `rgba(75, 114, 125, ${alpha})`,
    river: `rgba(42, 75, 99, ${alpha})`,
    shore: `rgba(179, 151, 103, ${alpha})`,
    sea: `rgba(29, 64, 89, ${alpha})`,
  };
  return palette[terrain] ?? `rgba(100, 92, 74, ${alpha})`;
}

function renderMap(
  canvas: HTMLCanvasElement,
  map: RegionMap,
  exploration: ExplorationState,
  compact: boolean,
): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssSize = compact ? 190 : Math.min(620, window.innerWidth - 40, window.innerHeight - 150);
  canvas.style.width = `${cssSize}px`;
  canvas.style.height = `${cssSize}px`;
  canvas.width = Math.max(1, Math.floor(cssSize * dpr));
  canvas.height = Math.max(1, Math.floor(cssSize * dpr));
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(dpr, dpr);
  context.clearRect(0, 0, cssSize, cssSize);
  context.fillStyle = compact ? "rgba(9, 13, 14, .66)" : "rgba(11, 13, 12, .94)";
  context.fillRect(0, 0, cssSize, cssSize);

  const radius = compact ? cssSize / 11.8 : cssSize / 12.1;
  const centerX = cssSize / 2;
  const centerY = cssSize / 2;
  const scaleX = radius * Math.sqrt(3);
  const scaleY = radius * 1.5;
  const centers = new Map<string, { x: number; y: number }>();

  for (const cell of map.cells) {
    const x = centerX + scaleX * (cell.coordinate.q + cell.coordinate.r / 2);
    const y = centerY + scaleY * cell.coordinate.r;
    centers.set(cell.id, { x, y });
    const knowledge = getCellKnowledge(exploration, cell.id);
    drawHex(context, x, y, radius - (compact ? 1.2 : 2));
    if (knowledge.fog === "hidden") {
      context.fillStyle = compact ? "rgba(5, 8, 9, .96)" : "rgba(4, 7, 8, .98)";
    } else {
      context.fillStyle = terrainColor(cell.terrain, knowledge.fog === "visible");
    }
    context.fill();
    context.strokeStyle = knowledge.fog === "visible" ? "rgba(232, 204, 151, .27)" : "rgba(210, 194, 167, .08)";
    context.lineWidth = compact ? 0.8 : 1.2;
    context.stroke();
    if (knowledge.visited) {
      drawHex(context, x, y, radius * 0.58);
      context.strokeStyle = "rgba(226, 185, 111, .42)";
      context.lineWidth = compact ? 1 : 1.5;
      context.stroke();
    }
  }

  for (const landmark of getDiscoveredLandmarks(map, exploration)) {
    const center = centers.get(landmark.cellId);
    if (!center) continue;
    context.beginPath();
    context.arc(center.x, center.y, compact ? 2.8 : 5.2, 0, Math.PI * 2);
    context.fillStyle = "#f0c071";
    context.fill();
    if (!compact) {
      context.font = "500 12px Inter, system-ui, sans-serif";
      context.fillStyle = "rgba(246, 229, 197, .9)";
      context.fillText(landmark.name, center.x + 8, center.y - 7);
    }
  }

  const party = centers.get(exploration.partyCellId);
  if (party) {
    context.beginPath();
    context.arc(party.x, party.y, compact ? 4.8 : 7.5, 0, Math.PI * 2);
    context.fillStyle = "#f6e5bd";
    context.shadowColor = "#f0a84d";
    context.shadowBlur = compact ? 8 : 13;
    context.fill();
    context.shadowBlur = 0;
    context.beginPath();
    context.arc(party.x, party.y, compact ? 8 : 12, 0, Math.PI * 2);
    context.strokeStyle = "rgba(240, 168, 77, .56)";
    context.stroke();
  }

  if (compact) {
    const gradient = context.createRadialGradient(centerX, centerY, cssSize * 0.24, centerX, centerY, cssSize * 0.58);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,.58)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, cssSize, cssSize);
  }
}

export function mountJourneyHud(root: HTMLElement, handlers: JourneyHudHandlers): {
  render(model: JourneyHudModel): void;
  toggleMap(force?: boolean): boolean;
  isMapOpen(): boolean;
} {
  root.innerHTML = `
    <div class="cinematic top"></div>
    <div class="cinematic bottom"></div>
    <section class="journey-status" aria-label="Состояние героев">
      <div class="era" id="era"></div>
      <div class="leader-line"><span id="leader-name"></span><button id="switch-leader" type="button">сменить</button></div>
      <div class="meter-row"><span>тело</span><i><b id="stamina-bar"></b></i></div>
      <div class="meter-row"><span>дух</span><i><b id="composure-bar"></b></i></div>
      <div class="tech" id="tech"></div>
    </section>
    <section class="objective-card">
      <span>ПУТЬ</span>
      <strong id="objective"></strong>
      <small id="location"></small>
    </section>
    <button class="minimap-button" id="map-button" type="button" aria-label="Открыть карту">
      <canvas id="mini-map"></canvas><span><kbd>M</kbd> карта</span>
    </button>
    <div class="world-whisper" id="whisper"></div>
    <button class="interaction hidden" id="interaction" type="button"></button>
    <div class="controls" id="controls"><kbd>WASD</kbd> идти · <kbd>Shift</kbd> бег · мышь — камера · <kbd>C</kbd> второй герой · <kbd>E</kbd> действие</div>
    <div class="toast hidden" id="toast"></div>
    <div class="intro-layer" id="intro-layer">
      <div class="intro-copy">
        <div class="greek">ΜΕΤΑΞΥ</div>
        <h1>Между</h1>
        <p>Абдера, около 430 года до н. э.</p>
        <p class="intro-lead">Двое выходят на восточную дорогу по следу слуха, который приписывают Демокриту. Карта знает меньше, чем путники.</p>
        <button id="start" type="button">Выйти за ворота</button>
        <small>Игровая итерация 0.2 · исследование региона</small>
      </div>
    </div>
    <div class="dialogue-layer hidden" id="dialogue-layer">
      <article class="dialogue-card">
        <div class="dialogue-eyebrow" id="dialogue-eyebrow"></div>
        <h2 id="dialogue-title"></h2>
        <div class="dialogue-copy" id="dialogue-copy"></div>
        <div class="dialogue-choices" id="dialogue-choices"></div>
      </article>
    </div>
    <div class="combat-layer hidden" id="combat-layer">
      <section class="combat-card">
        <header><span>СТОЛКНОВЕНИЕ</span><strong id="combat-round"></strong></header>
        <div class="combatants">
          <div><b id="combat-hero"></b><div class="combat-meter"><i id="combat-hero-resolve"></i></div><small id="combat-hero-stamina"></small></div>
          <em id="combat-distance"></em>
          <div class="enemy"><b>Старший у дороги</b><div class="combat-meter"><i id="combat-enemy-resolve"></i></div><small id="combat-enemy-stamina"></small></div>
        </div>
        <div class="combat-log" id="combat-log"></div>
        <div class="combat-actions" id="combat-actions"></div>
      </section>
    </div>
    <div class="map-layer hidden" id="map-layer">
      <section class="map-card">
        <header><div><span>КАРТА ПУТИ</span><h2>Фракийский берег</h2></div><button id="map-close" type="button" aria-label="Закрыть карту">×</button></header>
        <canvas id="world-map"></canvas>
        <footer><span id="map-progress"></span><span>Светлое — видимое сейчас · тусклое — уже пройденное</span></footer>
      </section>
    </div>
    <div class="utility">
      <button id="save" type="button">Записать путь</button>
      <button id="load" type="button">Вернуться к записи</button>
    </div>
  `;

  const elements = {
    intro: root.querySelector<HTMLElement>("#intro-layer")!,
    dialogue: root.querySelector<HTMLElement>("#dialogue-layer")!,
    combat: root.querySelector<HTMLElement>("#combat-layer")!,
    mapLayer: root.querySelector<HTMLElement>("#map-layer")!,
    era: root.querySelector<HTMLElement>("#era")!,
    leader: root.querySelector<HTMLElement>("#leader-name")!,
    tech: root.querySelector<HTMLElement>("#tech")!,
    objective: root.querySelector<HTMLElement>("#objective")!,
    location: root.querySelector<HTMLElement>("#location")!,
    stamina: root.querySelector<HTMLElement>("#stamina-bar")!,
    composure: root.querySelector<HTMLElement>("#composure-bar")!,
    whisper: root.querySelector<HTMLElement>("#whisper")!,
    interaction: root.querySelector<HTMLButtonElement>("#interaction")!,
    toast: root.querySelector<HTMLElement>("#toast")!,
    dialogueEyebrow: root.querySelector<HTMLElement>("#dialogue-eyebrow")!,
    dialogueTitle: root.querySelector<HTMLElement>("#dialogue-title")!,
    dialogueCopy: root.querySelector<HTMLElement>("#dialogue-copy")!,
    dialogueChoices: root.querySelector<HTMLElement>("#dialogue-choices")!,
    combatRound: root.querySelector<HTMLElement>("#combat-round")!,
    combatHero: root.querySelector<HTMLElement>("#combat-hero")!,
    combatHeroResolve: root.querySelector<HTMLElement>("#combat-hero-resolve")!,
    combatEnemyResolve: root.querySelector<HTMLElement>("#combat-enemy-resolve")!,
    combatHeroStamina: root.querySelector<HTMLElement>("#combat-hero-stamina")!,
    combatEnemyStamina: root.querySelector<HTMLElement>("#combat-enemy-stamina")!,
    combatDistance: root.querySelector<HTMLElement>("#combat-distance")!,
    combatLog: root.querySelector<HTMLElement>("#combat-log")!,
    combatActions: root.querySelector<HTMLElement>("#combat-actions")!,
    mapProgress: root.querySelector<HTMLElement>("#map-progress")!,
    miniMap: root.querySelector<HTMLCanvasElement>("#mini-map")!,
    worldMap: root.querySelector<HTMLCanvasElement>("#world-map")!,
  };

  let mapOpen = false;
  let lastModel: JourneyHudModel | null = null;

  root.querySelector("#start")!.addEventListener("click", handlers.onStart);
  root.querySelector("#switch-leader")!.addEventListener("click", handlers.onSwitchLeader);
  root.querySelector("#map-button")!.addEventListener("click", () => toggleMap());
  root.querySelector("#map-close")!.addEventListener("click", () => toggleMap(false));
  root.querySelector("#save")!.addEventListener("click", handlers.onSave);
  root.querySelector("#load")!.addEventListener("click", handlers.onLoad);
  elements.interaction.addEventListener("click", handlers.onInteract);

  function toggleMap(force?: boolean): boolean {
    mapOpen = force ?? !mapOpen;
    elements.mapLayer.classList.toggle("hidden", !mapOpen);
    if (mapOpen && lastModel) renderMap(elements.worldMap, lastModel.map, lastModel.exploration, false);
    return mapOpen;
  }

  function render(model: JourneyHudModel): void {
    lastModel = model;
    elements.intro.classList.toggle("hidden", model.mode !== "intro");
    elements.dialogue.classList.toggle("hidden", model.mode !== "dialogue" && model.mode !== "aftermath");
    elements.combat.classList.toggle("hidden", model.mode !== "combat");
    elements.era.textContent = model.yearLabel;
    elements.leader.textContent = heroName(model.leader);
    elements.tech.textContent = `${model.backend.toUpperCase()} · ${model.havok ? "Havok" : "кинематика"} · ${Math.round(model.fps)} FPS`;
    elements.objective.textContent = model.objective;
    elements.location.textContent = model.location;
    elements.stamina.style.width = `${Math.max(0, Math.min(100, model.stamina))}%`;
    elements.composure.style.width = `${Math.max(0, Math.min(100, model.composure))}%`;
    elements.whisper.textContent = model.whisper;
    elements.whisper.classList.toggle("hidden", !model.whisper);
    elements.interaction.textContent = model.interactionPrompt ? `E  ${model.interactionPrompt}` : "";
    elements.interaction.classList.toggle("hidden", !model.interactionPrompt || model.mode !== "travel");
    elements.toast.textContent = model.toast;
    elements.toast.classList.toggle("hidden", !model.toast);
    renderMap(elements.miniMap, model.map, model.exploration, true);
    if (mapOpen) renderMap(elements.worldMap, model.map, model.exploration, false);
    const discovered = getDiscoveredLandmarks(model.map, model.exploration).length;
    elements.mapProgress.textContent = `Открыто мест: ${discovered}/${model.map.landmarks.length} · исследовано: ${model.exploration.exploredCellIds.length}/${model.map.cells.length}`;

    elements.dialogueEyebrow.textContent = model.dialogue?.eyebrow ?? "";
    elements.dialogueTitle.textContent = model.dialogue?.title ?? "";
    elements.dialogueCopy.innerHTML = "";
    elements.dialogueChoices.innerHTML = "";
    if (model.dialogue) {
      for (const line of model.dialogue.lines) {
        const paragraph = document.createElement("p");
        paragraph.textContent = line;
        elements.dialogueCopy.appendChild(paragraph);
      }
      for (const choice of model.dialogue.choices) {
        const button = makeButton(choice.label, "dialogue-choice", () => handlers.onDialogueChoice(choice.id));
        if (choice.note) {
          const note = document.createElement("small");
          note.textContent = choice.note;
          button.appendChild(note);
        }
        elements.dialogueChoices.appendChild(button);
      }
    }

    elements.combatActions.innerHTML = "";
    elements.combatLog.innerHTML = "";
    if (model.combat) {
      elements.combatRound.textContent = `ход ${model.combat.round}`;
      elements.combatHero.textContent = model.combat.activeName;
      elements.combatHeroResolve.style.width = `${model.combat.heroResolve}%`;
      elements.combatEnemyResolve.style.width = `${model.combat.enemyResolve}%`;
      elements.combatHeroStamina.textContent = `выносливость ${model.combat.heroStamina}`;
      elements.combatEnemyStamina.textContent = `выносливость ${model.combat.enemyStamina}`;
      elements.combatDistance.textContent = model.combat.distance;
      for (const line of model.combat.log.slice(-5)) {
        const paragraph = document.createElement("p");
        paragraph.textContent = line;
        elements.combatLog.appendChild(paragraph);
      }
      for (const action of model.combat.actions) {
        const button = makeButton(action.label, "combat-action", () => handlers.onCombatAction(action.id), action.disabled);
        const note = document.createElement("small");
        note.textContent = action.note;
        button.appendChild(note);
        elements.combatActions.appendChild(button);
      }
    }
  }

  return {
    render,
    toggleMap,
    isMapOpen: () => mapOpen,
  };
}
