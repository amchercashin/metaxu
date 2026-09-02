import type { CampKind, EventCard, GameState } from "../sim/types";
import { campChoices } from "../sim/evening";

export interface OverlayHandlers {
  onChoice(id: string): void;
  onCamp(id: CampKind): void;
  onSave(): void;
  onLoad(): void;
}

export function mountOverlay(root: HTMLElement, handlers: OverlayHandlers): {
  render(state: GameState, card: EventCard | null, extra?: { backend?: string; havok?: boolean; toast?: string }): void;
  isBlocking(state: GameState): boolean;
} {
  root.innerHTML = `
    <div class="status" id="status"></div>
    <div class="topbar">
      <button class="stone" id="btn-save" type="button">Сохранить</button>
      <button class="stone" id="btn-load" type="button">Продолжить</button>
    </div>
    <div class="toast hidden" id="toast"></div>
    <div class="panel hidden" id="panel">
      <h2 id="title"></h2>
      <div id="body"></div>
      <div class="choices" id="choices"></div>
    </div>
    <div class="hud">
      <div><kbd>WASD</kbd> / стрелки — идти · <kbd>C</kbd>/<kbd>Tab</kbd> — сменить ведущего</div>
      <div>Вода несёт. <kbd>G</kbd> в реке — отпустить свиток · к тёплому кругу — событие</div>
    </div>
  `;
  root.querySelector("#btn-save")!.addEventListener("click", () => handlers.onSave());
  root.querySelector("#btn-load")!.addEventListener("click", () => handlers.onLoad());

  const panel = root.querySelector<HTMLElement>("#panel")!;
  const title = root.querySelector<HTMLElement>("#title")!;
  const body = root.querySelector<HTMLElement>("#body")!;
  const choices = root.querySelector<HTMLElement>("#choices")!;
  const status = root.querySelector<HTMLElement>("#status")!;
  const toast = root.querySelector<HTMLElement>("#toast")!;

  function showToast(text: string) {
    toast.textContent = text;
    toast.classList.toggle("hidden", !text);
  }

  function render(state: GameState, card: EventCard | null, extra?: { backend?: string; havok?: boolean; toast?: string }) {
    const leader = state.leader === "kleon" ? "Клеон" : "Аристон";
    const scroll =
      state.scroll === "intact" ? "свиток цел" :
      state.scroll === "wet" ? "свиток мокр" :
      state.scroll === "lost" ? "свиток потерян" : "свиток отдан";
    status.textContent = `${leader} ведёт · ${scroll} · спор: ${state.argument_of_day ?? "ещё нет"} · ${extra?.backend ?? ""}${extra?.havok ? " · Havok" : " · кинематика"}`;
    if (extra?.toast) showToast(extra.toast);

    const blocking =
      state.phase === "morning" ||
      state.phase === "event" ||
      (state.phase === "evening" && state.eveningLines.length === 0) ||
      (state.phase === "evening" && state.eveningLines.length > 0);

    if (!blocking && state.phase !== "evening") {
      panel.classList.add("hidden");
      return;
    }

    panel.classList.remove("hidden");
    choices.innerHTML = "";
    body.innerHTML = "";

    if (state.phase === "morning" && card) {
      title.textContent = card.title;
      for (const line of card.setup) {
        const p = document.createElement("p");
        p.textContent = line;
        body.appendChild(p);
      }
      for (const ch of card.choices) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = ch.label;
        b.addEventListener("click", () => handlers.onChoice(ch.id));
        choices.appendChild(b);
      }
      return;
    }

    if (state.phase === "event" && card) {
      title.textContent = card.title;
      for (const line of card.setup) {
        const p = document.createElement("p");
        p.textContent = line;
        body.appendChild(p);
      }
      for (const ch of card.choices) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = ch.label;
        b.addEventListener("click", () => handlers.onChoice(ch.id));
        choices.appendChild(b);
      }
      return;
    }

    if (state.phase === "evening") {
      if (state.eveningLines.length === 0) {
        title.textContent = "Вечер";
        const p = document.createElement("p");
        p.textContent = "День садится. Спор не закрыт. Где ночь?";
        body.appendChild(p);
        for (const ch of campChoices(state)) {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = ch.label;
          b.addEventListener("click", () => handlers.onCamp(ch.id));
          choices.appendChild(b);
        }
      } else {
        title.textContent = "У огня — и не у конца";
        for (const line of state.eveningLines) {
          const p = document.createElement("p");
          p.textContent = line;
          body.appendChild(p);
        }
      }
    }
  }

  return {
    render,
    isBlocking(state) {
      return state.phase === "morning" || state.phase === "event" || state.phase === "evening";
    },
  };
}
