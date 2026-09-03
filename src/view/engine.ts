import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";

export async function createGameEngine(
  canvas: HTMLCanvasElement,
  options: { forceWebGL2?: boolean } = {},
): Promise<{
  engine: AbstractEngine;
  backend: "webgpu" | "webgl2";
}> {
  if (!options.forceWebGL2) {
    try {
      const supported = await WebGPUEngine.IsSupportedAsync;
      if (supported) {
        const engine = new WebGPUEngine(canvas, {
          antialias: true,
          adaptToDeviceRatio: true,
        });
        await engine.initAsync();
        return { engine, backend: "webgpu" };
      }
    } catch (err) {
      console.warn("WebGPU unavailable, falling back to WebGL2", err);
    }
  }
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    disableWebGL2Support: false,
    adaptToDeviceRatio: true,
  });
  return { engine, backend: "webgl2" };
}
