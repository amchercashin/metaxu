import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import "@babylonjs/core/Physics/v2/physicsEngineComponent";
import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export async function enableHavok(scene: Scene): Promise<{ ok: boolean; plugin: HavokPlugin | null }> {
  try {
    const mod = await import("@babylonjs/havok");
    const HavokPhysics = mod.default;
    // Let Vite's emitted Havok module resolve its content-hashed WASM asset.
    // Retrying the same Emscripten factory after a bad manual URL can leave its
    // singleton initialization pending forever in production.
    const instance = await HavokPhysics();
    const plugin = new HavokPlugin(true, instance as never);
    scene.enablePhysics(new Vector3(0, -18, 0), plugin);
    return { ok: true, plugin };
  } catch (err) {
    console.warn("Havok wasm failed; kinematic characters + current still run", err);
    return { ok: false, plugin: null };
  }
}
