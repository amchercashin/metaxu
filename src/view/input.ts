export interface InputState {
  forward: number;
  strafe: number;
  sprint: boolean;
  switchLeader: boolean;
  dropScroll: boolean;
  interact: boolean;
  toggleMap: boolean;
  attack: boolean;
  dodge: boolean;
  cancel: boolean;
}

export function createInput(target: HTMLElement | Window = window): {
  sample(): InputState;
  dispose(): void;
} {
  const down = new Set<string>();
  let switchLeader = false;
  let dropScroll = false;
  let interact = false;
  let toggleMap = false;
  let attack = false;
  let dodge = false;
  let cancel = false;

  const onDown = (e: KeyboardEvent) => {
    down.add(e.code);
    if (e.code === "Tab") e.preventDefault();
    if (e.code === "KeyC" || e.code === "Tab") switchLeader = true;
    if (e.code === "KeyG") dropScroll = true;
    if (e.code === "KeyE") interact = true;
    if (e.code === "KeyM") toggleMap = true;
    if (e.code === "KeyF" || e.code === "Mouse0") attack = true;
    if (e.code === "Space") {
      e.preventDefault();
      dodge = true;
    }
    if (e.code === "Escape") cancel = true;
  };
  const onUp = (e: KeyboardEvent) => {
    down.delete(e.code);
  };
  const onBlur = () => down.clear();
  const onPointerDown = (e: PointerEvent) => {
    if (e.button === 0) attack = true;
  };

  target.addEventListener("keydown", onDown as EventListener);
  target.addEventListener("keyup", onUp as EventListener);
  target.addEventListener("pointerdown", onPointerDown as EventListener);
  window.addEventListener("blur", onBlur);

  return {
    sample() {
      const forward =
        (down.has("KeyW") || down.has("ArrowUp") ? 1 : 0) -
        (down.has("KeyS") || down.has("ArrowDown") ? 1 : 0);
      const strafe =
        (down.has("KeyD") || down.has("ArrowRight") ? 1 : 0) -
        (down.has("KeyA") || down.has("ArrowLeft") ? 1 : 0);
      const state: InputState = {
        forward,
        strafe,
        sprint: down.has("ShiftLeft") || down.has("ShiftRight"),
        switchLeader,
        dropScroll,
        interact,
        toggleMap,
        attack,
        dodge,
        cancel,
      };
      switchLeader = false;
      dropScroll = false;
      interact = false;
      toggleMap = false;
      attack = false;
      dodge = false;
      cancel = false;
      return state;
    },
    dispose() {
      target.removeEventListener("keydown", onDown as EventListener);
      target.removeEventListener("keyup", onUp as EventListener);
      target.removeEventListener("pointerdown", onPointerDown as EventListener);
      window.removeEventListener("blur", onBlur);
    },
  };
}
