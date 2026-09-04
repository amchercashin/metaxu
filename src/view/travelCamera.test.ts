import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it } from "vitest";
import { createTravelCamera, TravelCameraController } from "./travelCamera";

function withScene(run: (scene: Scene) => void): void {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    run(scene);
  } finally {
    scene.dispose();
    engine.dispose();
  }
}

describe("travel camera", () => {
  it("starts behind the party with a shallow landscape pitch", () => {
    withScene((scene) => {
      const controller = createTravelCamera(scene, null, new Vector3(-2, 2.4, 0));
      const camera = controller.camera;

      expect(camera.alpha).toBeCloseTo(Math.PI);
      expect(camera.beta).toBeCloseTo(1.43);
      expect(camera.radius).toBeCloseTo(13.5);
      expect(camera.fov).toBeCloseTo(0.78);
      expect(camera.panningSensibility).toBe(0);
    });
  });

  it("follows the pair without changing the player's orbit or its inertia", () => {
    withScene((scene) => {
      const camera = new ArcRotateCamera(
        "test-travel-camera",
        0.72,
        1.18,
        17.25,
        new Vector3(0, 1.35, 0),
        scene,
      );
      camera.inertialAlphaOffset = 0.08;
      camera.inertialBetaOffset = -0.025;
      camera.inertialRadiusOffset = 0.4;
      const controller = new TravelCameraController(camera);
      const orbit = {
        alpha: camera.alpha,
        beta: camera.beta,
        radius: camera.radius,
        alphaInertia: camera.inertialAlphaOffset,
        betaInertia: camera.inertialBetaOffset,
        radiusInertia: camera.inertialRadiusOffset,
      };

      controller.update({
        leaderPosition: new Vector3(8, 0.7, -3),
        companionPosition: new Vector3(5.8, 0.9, -2),
        leaderVelocity: new Vector3(6, 0, 1),
      }, 1 / 60);

      expect(camera.getTarget().x).toBeGreaterThan(0);
      expect(camera.alpha).toBe(orbit.alpha);
      expect(camera.beta).toBe(orbit.beta);
      expect(camera.radius).toBe(orbit.radius);
      expect(camera.inertialAlphaOffset).toBe(orbit.alphaInertia);
      expect(camera.inertialBetaOffset).toBe(orbit.betaInertia);
      expect(camera.inertialRadiusOffset).toBe(orbit.radiusInertia);
    });
  });

  it("smoothly converges and clamps a companion who falls far behind", () => {
    withScene((scene) => {
      const camera = new ArcRotateCamera(
        "test-follow-camera",
        Math.PI,
        1.43,
        13.5,
        new Vector3(0, 1.35, 0),
        scene,
      );
      const controller = new TravelCameraController(camera);
      const focus = {
        leaderPosition: new Vector3(20, 1, 0),
        companionPosition: new Vector3(-80, 1, 0),
        leaderVelocity: Vector3.Zero(),
      };

      controller.update(focus, 1 / 60);
      const firstX = camera.getTarget().x;
      for (let i = 0; i < 180; i += 1) controller.update(focus, 1 / 60);

      expect(firstX).toBeGreaterThan(0);
      expect(camera.getTarget().x).toBeGreaterThan(17);
      expect(camera.getTarget().x).toBeLessThan(20);
      expect(camera.alpha).toBeCloseTo(Math.PI);
      expect(camera.beta).toBeCloseTo(1.43);
      expect(camera.radius).toBeCloseTo(13.5);
    });
  });
});
