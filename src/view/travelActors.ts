import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import type { HeroId } from "../sim/types";
import type { InputState } from "./input";

export interface TravelActor {
  id: HeroId | `road-guard-${number}`;
  root: TransformNode;
  velocity: Vector3;
  walkClock: number;
  actionClock: number;
  bodyMeshes: AbstractMesh[];
  leftArm: TransformNode;
  rightArm: TransformNode;
  leftLeg: TransformNode;
  rightLeg: TransformNode;
  weapon: TransformNode | null;
  speed: number;
}

export interface TravelParty {
  kleon: TravelActor;
  ariston: TravelActor;
}

export interface PartyStepResult {
  leader: TravelActor;
  follower: TravelActor;
  speed: number;
  moved: boolean;
}

type HeightAt = (x: number, z: number) => number;

function material(scene: Scene, name: string, color: Color3, roughness = 0.76, metallic = 0): PBRMaterial {
  const result = new PBRMaterial(name, scene);
  result.albedoColor = color;
  result.roughness = roughness;
  result.metallic = metallic;
  result.environmentIntensity = 0.72;
  return result;
}

function limb(scene: Scene, name: string, height: number, diameter: number, mat: PBRMaterial): {
  pivot: TransformNode;
  mesh: Mesh;
} {
  const pivot = new TransformNode(`${name}-pivot`, scene);
  const mesh = MeshBuilder.CreateCylinder(name, {
    height,
    diameterTop: diameter * 0.82,
    diameterBottom: diameter,
    tessellation: 10,
  }, scene);
  mesh.parent = pivot;
  mesh.position.y = -height / 2;
  mesh.material = mat;
  return { pivot, mesh };
}

function createFigure(
  scene: Scene,
  id: TravelActor["id"],
  palette: { skin: Color3; cloth: Color3; cloak: Color3; leather: Color3; hair: Color3 },
  stature: number,
  armed: boolean,
): TravelActor {
  const root = new TransformNode(id, scene);
  root.scaling.setAll(stature);
  const skin = material(scene, `${id}-skin`, palette.skin, 0.67);
  const cloth = material(scene, `${id}-cloth`, palette.cloth, 0.93);
  const cloakMat = material(scene, `${id}-cloak`, palette.cloak, 0.98);
  const leather = material(scene, `${id}-leather`, palette.leather, 0.84);
  const hair = material(scene, `${id}-hair`, palette.hair, 1);
  const bronze = material(scene, `${id}-bronze`, new Color3(0.42, 0.24, 0.08), 0.34, 0.65);
  const wood = material(scene, `${id}-wood`, new Color3(0.24, 0.12, 0.055), 0.94);
  const bodyMeshes: AbstractMesh[] = [];

  const hips = MeshBuilder.CreateCylinder(`${id}-hips`, {
    height: 0.42,
    diameterTop: 0.78,
    diameterBottom: 0.6,
    tessellation: 12,
  }, scene);
  hips.parent = root;
  hips.position.y = 1.18;
  hips.material = leather;
  bodyMeshes.push(hips);

  const tunic = MeshBuilder.CreateCylinder(`${id}-tunic`, {
    height: 1.12,
    diameterTop: 0.78,
    diameterBottom: 1.03,
    tessellation: 14,
  }, scene);
  tunic.parent = root;
  tunic.position.y = 1.73;
  tunic.material = cloth;
  bodyMeshes.push(tunic);

  const belt = MeshBuilder.CreateTorus(`${id}-belt`, { diameter: 0.77, thickness: 0.075, tessellation: 18 }, scene);
  belt.parent = root;
  belt.position.y = 1.49;
  belt.rotation.x = Math.PI / 2;
  belt.material = leather;
  bodyMeshes.push(belt);

  const neck = MeshBuilder.CreateCylinder(`${id}-neck`, { height: 0.22, diameter: 0.28, tessellation: 10 }, scene);
  neck.parent = root;
  neck.position.y = 2.38;
  neck.material = skin;
  bodyMeshes.push(neck);

  const head = MeshBuilder.CreateSphere(`${id}-head`, { diameter: 0.54, segments: 16 }, scene);
  head.parent = root;
  head.position.y = 2.69;
  head.scaling.set(0.9, 1.08, 0.92);
  head.material = skin;
  bodyMeshes.push(head);

  const hairCap = MeshBuilder.CreateSphere(`${id}-hair-cap`, { diameter: 0.565, segments: 12, slice: 0.57 }, scene);
  hairCap.parent = root;
  hairCap.position.y = 2.79;
  hairCap.rotation.x = Math.PI;
  hairCap.scaling.set(0.93, 0.72, 0.95);
  hairCap.material = hair;
  bodyMeshes.push(hairCap);

  const nose = MeshBuilder.CreateCylinder(`${id}-nose`, {
    height: 0.16,
    diameterTop: 0.025,
    diameterBottom: 0.09,
    tessellation: 8,
  }, scene);
  nose.parent = root;
  nose.position.set(0, 2.69, 0.27);
  nose.rotation.x = Math.PI / 2;
  nose.material = skin;
  bodyMeshes.push(nose);

  const cloak = MeshBuilder.CreatePlane(`${id}-cloak`, { width: 0.93, height: 1.48, sideOrientation: Mesh.DOUBLESIDE }, scene);
  cloak.parent = root;
  cloak.position.set(0, 1.78, -0.43);
  cloak.rotation.x = -0.09;
  cloak.material = cloakMat;
  bodyMeshes.push(cloak);

  const leftLeg = limb(scene, `${id}-left-leg`, 1.06, 0.29, skin);
  const rightLeg = limb(scene, `${id}-right-leg`, 1.06, 0.29, skin);
  for (const [side, part] of [[-1, leftLeg], [1, rightLeg]] as const) {
    part.pivot.parent = root;
    part.pivot.position.set(side * 0.21, 1.08, 0);
    bodyMeshes.push(part.mesh);
    const sandal = MeshBuilder.CreateBox(`${id}-${side}-sandal`, { width: 0.27, height: 0.1, depth: 0.48 }, scene);
    sandal.parent = part.pivot;
    sandal.position.set(0, -1.06, 0.08);
    sandal.material = leather;
    bodyMeshes.push(sandal);
  }

  const leftArm = limb(scene, `${id}-left-arm`, 0.98, 0.24, skin);
  const rightArm = limb(scene, `${id}-right-arm`, 0.98, 0.24, skin);
  for (const [side, part] of [[-1, leftArm], [1, rightArm]] as const) {
    part.pivot.parent = root;
    part.pivot.position.set(side * 0.49, 2.14, 0);
    part.pivot.rotation.z = side * -0.08;
    bodyMeshes.push(part.mesh);
  }

  const brooch = MeshBuilder.CreateSphere(`${id}-brooch`, { diameter: 0.13, segments: 10 }, scene);
  brooch.parent = root;
  brooch.position.set(-0.35, 2.2, 0.37);
  brooch.material = bronze;
  bodyMeshes.push(brooch);

  let weapon: TransformNode | null = null;
  if (armed) {
    weapon = new TransformNode(`${id}-spear`, scene);
    weapon.parent = rightArm.pivot;
    weapon.position.set(0, -0.72, 0.1);
    weapon.rotation.x = 0.1;
    const shaft = MeshBuilder.CreateCylinder(`${id}-spear-shaft`, { height: 2.65, diameter: 0.055, tessellation: 8 }, scene);
    shaft.parent = weapon;
    shaft.position.y = -0.02;
    shaft.material = wood;
    const tip = MeshBuilder.CreateCylinder(`${id}-spear-tip`, {
      height: 0.32,
      diameterTop: 0,
      diameterBottom: 0.12,
      tessellation: 8,
    }, scene);
    tip.parent = weapon;
    tip.position.y = 1.48;
    tip.material = bronze;
    bodyMeshes.push(shaft, tip);
  }

  return {
    id,
    root,
    velocity: Vector3.Zero(),
    walkClock: 0,
    actionClock: 0,
    bodyMeshes,
    leftArm: leftArm.pivot,
    rightArm: rightArm.pivot,
    leftLeg: leftLeg.pivot,
    rightLeg: rightLeg.pivot,
    weapon,
    speed: id === "kleon" ? 6.2 : id === "ariston" ? 5.65 : 4.7,
  };
}

export function createTravelParty(scene: Scene, spawn: Vector3): TravelParty {
  const kleon = createFigure(scene, "kleon", {
    skin: new Color3(0.61, 0.4, 0.27),
    cloth: new Color3(0.72, 0.58, 0.36),
    cloak: new Color3(0.15, 0.29, 0.31),
    leather: new Color3(0.2, 0.11, 0.06),
    hair: new Color3(0.12, 0.075, 0.045),
  }, 0.72, true);
  const ariston = createFigure(scene, "ariston", {
    skin: new Color3(0.56, 0.35, 0.23),
    cloth: new Color3(0.37, 0.29, 0.2),
    cloak: new Color3(0.43, 0.17, 0.11),
    leather: new Color3(0.17, 0.085, 0.04),
    hair: new Color3(0.09, 0.055, 0.035),
  }, 0.77, true);
  kleon.root.position.copyFrom(spawn);
  kleon.root.position.z -= 0.85;
  ariston.root.position.copyFrom(spawn);
  ariston.root.position.z += 1.05;
  return { kleon, ariston };
}

export function createRoadGuards(scene: Scene, origin: Vector3): TravelActor[] {
  return [0, 1, 2].map((index) => {
    const guard = createFigure(scene, `road-guard-${index}`, {
      skin: new Color3(0.54 + index * 0.025, 0.34, 0.22),
      cloth: new Color3(0.2, 0.18 + index * 0.02, 0.17),
      cloak: new Color3(0.31, 0.12 + index * 0.025, 0.08),
      leather: new Color3(0.13, 0.07, 0.035),
      hair: new Color3(0.08, 0.05, 0.035),
    }, 0.74 + index * 0.035, true);
    guard.root.position.copyFrom(origin.add(new Vector3(-1.9 + index * 1.8, 0, -1 + Math.abs(index - 1) * 1.5)));
    guard.root.rotation.y = Math.PI * 0.82;
    return guard;
  });
}

export function addActorShadows(actor: TravelActor, add: (mesh: AbstractMesh) => void): void {
  for (const mesh of actor.bodyMeshes) {
    mesh.receiveShadows = true;
    add(mesh);
  }
}

function animate(actor: TravelActor, dt: number, moving: boolean, running: boolean): void {
  const planarSpeed = Math.hypot(actor.velocity.x, actor.velocity.z);
  actor.walkClock += dt * (moving ? 5.4 + planarSpeed * 0.58 : 1.7);
  const strength = moving ? (running ? 0.74 : 0.48) : 0.025;
  const swing = Math.sin(actor.walkClock) * strength;
  actor.leftLeg.rotation.x += (swing - actor.leftLeg.rotation.x) * Math.min(1, dt * 13);
  actor.rightLeg.rotation.x += (-swing - actor.rightLeg.rotation.x) * Math.min(1, dt * 13);
  const idleBreath = Math.sin(actor.walkClock * 0.42) * 0.025;
  const action = actor.actionClock > 0 ? Math.sin((0.42 - actor.actionClock) / 0.42 * Math.PI) * 1.65 : 0;
  actor.leftArm.rotation.x += (-swing * 0.62 + idleBreath - actor.leftArm.rotation.x) * Math.min(1, dt * 12);
  actor.rightArm.rotation.x += (swing * 0.62 - action + idleBreath - actor.rightArm.rotation.x) * Math.min(1, dt * 15);
  if (actor.actionClock > 0) actor.actionClock = Math.max(0, actor.actionClock - dt);
}

function integrate(
  actor: TravelActor,
  wish: Vector3,
  dt: number,
  heightAt: HeightAt,
  sprint: boolean,
): void {
  const maxSpeed = actor.speed * (sprint ? 1.52 : 1);
  const acceleration = sprint ? 15 : 11;
  const targetVelocity = wish.scale(maxSpeed);
  const blend = 1 - Math.exp(-acceleration * dt);
  actor.velocity.x += (targetVelocity.x - actor.velocity.x) * blend;
  actor.velocity.z += (targetVelocity.z - actor.velocity.z) * blend;
  actor.root.position.x += actor.velocity.x * dt;
  actor.root.position.z += actor.velocity.z * dt;
  actor.root.position.x = Math.max(-99, Math.min(99, actor.root.position.x));
  actor.root.position.z = Math.max(-99, Math.min(66, actor.root.position.z));
  actor.root.position.y = heightAt(actor.root.position.x, actor.root.position.z);
  if (wish.lengthSquared() > 0.001) {
    const yaw = Math.atan2(wish.x, wish.z);
    let delta = yaw - actor.root.rotation.y;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    actor.root.rotation.y += delta * Math.min(1, dt * 10);
  }
  animate(actor, dt, wish.lengthSquared() > 0.001, sprint);
}

export function stepTravelParty(
  party: TravelParty,
  leaderId: HeroId,
  input: InputState,
  worldWish: Vector3,
  dt: number,
  heightAt: HeightAt,
  blocked: boolean,
): PartyStepResult {
  const leader = leaderId === "kleon" ? party.kleon : party.ariston;
  const follower = leaderId === "kleon" ? party.ariston : party.kleon;
  const wish = blocked ? Vector3.Zero() : worldWish;
  integrate(leader, wish, dt, heightAt, input.sprint && !blocked);

  const behind = new Vector3(-Math.sin(leader.root.rotation.y), 0, -Math.cos(leader.root.rotation.y)).scale(2.15);
  const side = new Vector3(Math.cos(leader.root.rotation.y), 0, -Math.sin(leader.root.rotation.y)).scale(1.05);
  const target = leader.root.position.add(behind).add(side);
  const toTarget = target.subtract(follower.root.position);
  toTarget.y = 0;
  const distance = toTarget.length();
  const followWish = distance > 0.75 ? toTarget.normalize() : Vector3.Zero();
  integrate(follower, followWish, dt, heightAt, distance > 5.4);

  return {
    leader,
    follower,
    speed: Math.hypot(leader.velocity.x, leader.velocity.z),
    moved: wish.lengthSquared() > 0.001,
  };
}

export function triggerAttack(actor: TravelActor): void {
  actor.actionClock = 0.42;
}

export function animateIdleActors(actors: TravelActor[], dt: number): void {
  for (const actor of actors) animate(actor, dt, false, false);
}
