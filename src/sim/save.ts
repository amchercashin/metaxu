import type { GameState, SaveAdapter, SaveSnapshot } from "./types";

export function toSnapshot(state: GameState, now = new Date()): SaveSnapshot {
  return {
    version: 1,
    savedAt: now.toISOString(),
    state: structuredClone(state),
  };
}

export function fromSnapshot(snap: SaveSnapshot): GameState {
  if (snap.version !== 1 || !snap.state) {
    throw new Error("Неверный снимок");
  }
  return structuredClone(snap.state);
}

export class MemorySaveAdapter implements SaveAdapter {
  private slots = new Map<string, SaveSnapshot>();

  async write(slot: string, snapshot: SaveSnapshot): Promise<void> {
    this.slots.set(slot, structuredClone(snapshot));
  }

  async read(slot: string): Promise<SaveSnapshot | null> {
    const found = this.slots.get(slot);
    return found ? structuredClone(found) : null;
  }

  async remove(slot: string): Promise<void> {
    this.slots.delete(slot);
  }
}

export async function saveState(adapter: SaveAdapter, state: GameState, slot = "day"): Promise<SaveSnapshot> {
  const snap = toSnapshot(state);
  await adapter.write(slot, snap);
  return snap;
}

export async function loadState(adapter: SaveAdapter, slot = "day"): Promise<GameState | null> {
  const snap = await adapter.read(slot);
  if (!snap) return null;
  return fromSnapshot(snap);
}
