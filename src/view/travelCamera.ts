import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

const START_ALPHA = Math.PI;
const START_BETA = 1.43;
const START_RADIUS = 13.5;
const FOCUS_HEIGHT = 1.35;
const COMPANION_WEIGHT = 0.42;
const MAX_COMPANION_OFFSET = 4.5;
const LOOK_AHEAD_SECONDS = 0.28;
const MAX_LOOK_AHEAD = 2.35;
const FOLLOW_SHARPNESS = 4.6;

export interface TravelCameraFocus {
  leaderPosition: Vector3;
  companionPosition: Vector3;
  leaderVelocity: Vector3;
}

/**
 * Moves only the centre of the ArcRotate orbit. The player's angle, zoom and
 * input inertia deliberately remain owned by Babylon's camera controls.
 */
export class TravelCameraController {
  readonly camera: ArcRotateCamera;

  private readonly desiredTarget = Vector3.Zero();
  private readonly targetBuffers = [Vector3.Zero(), Vector3.Zero()] as const;
  private nextTargetBuffer = 0;

  constructor(camera: ArcRotateCamera) {
    this.camera = camera;
  }

  snapTo(focus: TravelCameraFocus): void {
    this.computeDesiredTarget(focus);
    const nextTarget = this.takeTargetBuffer();
    nextTarget.copyFrom(this.desiredTarget);
    this.camera.setTarget(nextTarget, false, false, true);
  }

  update(focus: TravelCameraFocus, deltaSeconds: number): void {
    this.computeDesiredTarget(focus);
    const dt = Math.max(0, Math.min(0.1, deltaSeconds));
    const blend = 1 - Math.exp(-FOLLOW_SHARPNESS * dt);
    const nextTarget = this.takeTargetBuffer();
    Vector3.LerpToRef(this.camera.getTarget(), this.desiredTarget, blend, nextTarget);

    // cloneAlphaBetaRadius=true is essential here: the default setTarget()
    // rebuilds the orbit and would gradually undo a player's mouse rotation.
    this.camera.setTarget(nextTarget, false, false, true);
  }

  private takeTargetBuffer(): Vector3 {
    const target = this.targetBuffers[this.nextTargetBuffer];
    this.nextTargetBuffer = this.nextTargetBuffer === 0 ? 1 : 0;
    return target;
  }

  private computeDesiredTarget(focus: TravelCameraFocus): void {
    const companionX = focus.companionPosition.x - focus.leaderPosition.x;
    const companionZ = focus.companionPosition.z - focus.leaderPosition.z;
    const companionDistance = Math.hypot(companionX, companionZ);
    const companionScale = companionDistance > MAX_COMPANION_OFFSET
      ? MAX_COMPANION_OFFSET / companionDistance
      : 1;

    const speed = Math.hypot(focus.leaderVelocity.x, focus.leaderVelocity.z);
    const lookAheadScale = speed > 0.01
      ? Math.min(LOOK_AHEAD_SECONDS, MAX_LOOK_AHEAD / speed)
      : 0;

    this.desiredTarget.set(
      focus.leaderPosition.x + companionX * companionScale * COMPANION_WEIGHT
        + focus.leaderVelocity.x * lookAheadScale,
      focus.leaderPosition.y
        + (focus.companionPosition.y - focus.leaderPosition.y) * COMPANION_WEIGHT
        + FOCUS_HEIGHT,
      focus.leaderPosition.z + companionZ * companionScale * COMPANION_WEIGHT
        + focus.leaderVelocity.z * lookAheadScale,
    );
  }
}

export function createTravelCamera(
  scene: Scene,
  canvas: HTMLCanvasElement | null,
  initialFocus: Vector3,
): TravelCameraController {
  // A shallow downward pitch keeps the landscape horizon near the upper third
  // while leaving enough ground in frame to read the party and the road.
  const camera = new ArcRotateCamera(
    "travel-camera",
    START_ALPHA,
    START_BETA,
    START_RADIUS,
    initialFocus,
    scene,
  );
  camera.fov = 0.78;
  camera.lowerRadiusLimit = 8;
  camera.upperRadiusLimit = 22;
  camera.lowerBetaLimit = 0.68;
  camera.upperBetaLimit = 1.5;
  camera.wheelPrecision = 34;
  camera.angularSensibilityX = 1800;
  camera.angularSensibilityY = 1800;
  camera.useNaturalPinchZoom = true;
  camera.panningSensibility = 0;
  camera.inertia = 0.8;
  camera.minZ = 0.08;
  camera.keysUp = [];
  camera.keysDown = [];
  camera.keysLeft = [];
  camera.keysRight = [];
  if (canvas) camera.attachControl(canvas, true);
  scene.activeCamera = camera;

  return new TravelCameraController(camera);
}
