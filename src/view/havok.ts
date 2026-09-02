import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import "@babylonjs/core/Physics/v2/physicsEngineComponent";
import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export async function enableHavok(scene: Scene): Promise<{ ok: boolean; plugin: HavokPlugin | null }> {
  try {
    const mod = await import("@babylonjs/havok");
    const HavokPhysics = mod.default;
    const wasmUrl = `${import.meta.env.BASE_URL}HavokPhysics.wasm`;
    let instance: unknown;
    try {
      instance = await HavokPhysics({
        locateFile: (file: string) => (file.endsWith(".wasm") ? wasmUrl : file),
      });
    } catch {
      instance = await HavokPhysics();
    }
    const plugin = new HavokPlugin(true, instance as never);
    scene.enablePhysics(new Vector3(0, -18, 0), plugin);
    return { ok: true, plugin };
  } catch (err) {
    console.warn("Havok wasm failed; kinematic characters + current still run", err);
    return { ok: false, plugin: null };
  }
}
