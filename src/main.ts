import "./ui/overlay.css";
import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { loadRiverCatalog, cardById } from "./content/catalog";
import {
  beginEvent,
  carryingScroll,
  dropScrollInWater,
  finishEvening,
  loadState,
  noteCrossedRiver,
  resolveEvent,
  resolveMorning,
  saveState,
  startDay,
  switchLeader,
  type CampKind,
  type GameState,
} from "./sim";
import { IndexedDbSaveAdapter } from "./ui/idb";
import { mountOverlay } from "./ui/overlay";
import { createGameEngine } from "./view/engine";
import { enableHavok } from "./view/havok";
import { createInput } from "./view/input";
import { createActors, nearestEvent, placeMarkers, stepActors } from "./view/actors";
import { RIVER_Z1, buildRibbonWorld } from "./view/world";

const cards = loadRiverCatalog();
const SLOT = "day";

async function boot(): Promise<void> {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  canvas.tabIndex = 0;
  canvas.focus();
  const { engine, backend } = await createGameEngine(canvas);
  const scene = new Scene(engine);
  const havok = await enableHavok(scene);
  buildRibbonWorld(scene, havok.ok);
  const actors = createActors(scene);
  const camera = new UniversalCamera("cam", new Vector3(0, 12, -6), scene);
  camera.minZ = 0.1;
  camera.inputs.clear();
  scene.activeCamera = camera;

  const save = new IndexedDbSaveAdapter();
  let seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  let state: GameState = startDay(cards, seed);
  let toast = "";

  const input = createInput(window);
  const ui = mountOverlay(document.getElementById("ui-root")!, {
    onChoice(id) {
      if (state.phase === "morning") {
        state = resolveMorning(state, cards, id);
        const selected = state.selectedEventIds
          .map((eid) => cardById(eid))
          .filter((c): c is NonNullable<typeof c> => Boolean(c));
        placeMarkers(scene, actors.markers, selected);
      } else if (state.phase === "event") {
        const current = state.currentEventId;
        state = resolveEvent(state, cards, id);
        if (current) {
          const mark = actors.markers.get(current);
          mark?.dispose();
          actors.markers.delete(current);
        }
      }
      paint();
    },
    onCamp(id: CampKind) {
      state = finishEvening(state, id);
      paint();
    },
    async onSave() {
      await saveState(save, state, SLOT);
      toast = "День записан (IndexedDB)";
      paint();
      window.setTimeout(() => {
        toast = "";
        paint();
      }, 2200);
    },
    async onLoad() {
      const loaded = await loadState(save, SLOT);
      if (!loaded) {
        toast = "Нет записи";
        paint();
        return;
      }
      state = loaded;
      const selected = state.selectedEventIds
        .map((eid) => cardById(eid))
        .filter((c): c is NonNullable<typeof c> => Boolean(c) && !state.completedEventIds.includes(c!.id));
      placeMarkers(scene, actors.markers, selected);
      toast = "Вернулись к записи";
      paint();
    },
  });

  function currentCard() {
    if (state.phase === "morning") return cardById("RIVER_00") ?? null;
    if (state.currentEventId) return cardById(state.currentEventId) ?? null;
    return null;
  }

  function paint() {
    ui.render(state, currentCard(), { backend, havok: havok.ok, toast });
  }
  paint();

  window.addEventListener("resize", () => engine.resize());

  engine.runRenderLoop(() => {
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
    const sample = input.sample();
    const blocking = ui.isBlocking(state);
    if (sample.switchLeader && !blocking) {
      state = switchLeader(state);
      paint();
    }
    const { droppedScroll, leader } = stepActors(
      actors,
      state.leader,
      sample,
      dt,
      blocking,
      carryingScroll(state),
    );
    if (droppedScroll) {
      state = dropScrollInWater(state);
      paint();
    }
    if (leader.root.position.z > RIVER_Z1 + 1 && !state.crossedRiver) {
      state = noteCrossedRiver(state);
    }
    if (state.phase === "travel") {
      const near = nearestEvent(actors.markers, leader);
      if (near) {
        state = beginEvent(state, near);
        paint();
      }
    }
    const look = actors.kleon.root.position.add(actors.ariston.root.position).scale(0.5);
    look.y += 1.2;
    const behind = leader.root.position.add(new Vector3(0, 7.4, -11));
    camera.position = Vector3.Lerp(camera.position, behind, 1 - Math.pow(0.08, dt * 60));
    camera.setTarget(look);
    scene.render();
  });
}

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById("ui-root");
  if (el) el.textContent = String(err);
});
