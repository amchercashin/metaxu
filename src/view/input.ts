export interface InputState {
  forward: number;
  strafe: number;
  switchLeader: boolean;
  dropScroll: boolean;
  interact: boolean;
}

export function createInput(target: HTMLElement | Window = window): {
  sample(): InputState;
  dispose(): void;
} {
  const down = new Set<string>();
  let switchLeader = false;
  let dropScroll = false;
  let interact = false;

  const onDown = (e: KeyboardEvent) => {
    down.add(e.code);
    if (e.code === "Tab") e.preventDefault();
    if (e.code === "KeyC" || e.code === "Tab") switchLeader = true;
    if (e.code === "KeyG") dropScroll = true;
    if (e.code === "KeyE") interact = true;
  };
  const onUp = (e: KeyboardEvent) => {
    down.delete(e.code);
  };
  const onBlur = () => down.clear();

  target.addEventListener("keydown", onDown as EventListener);
  target.addEventListener("keyup", onUp as EventListener);
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
        switchLeader,
        dropScroll,
        interact,
      };
      switchLeader = false;
      dropScroll = false;
      interact = false;
      return state;
    },
    dispose() {
      target.removeEventListener("keydown", onDown as EventListener);
      target.removeEventListener("keyup", onUp as EventListener);
      window.removeEventListener("blur", onBlur);
    },
  };
}
