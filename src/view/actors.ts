import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import type { HeroId } from "../sim/types";
import { CURRENT, WATER_Y, groundHeight, inRiver } from "./world";
import type { InputState } from "./input";

export interface Actor {
  id: HeroId;
  root: TransformNode;
  mesh: Mesh;
  vel: Vector3;
  height: number;
  radius: number;
  speed: number;
  inWater: boolean;
}

function tint(scene: Scene, name: string, color: Color3): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.specularColor = color.scale(0.12);
  m.emissiveColor = color.scale(0.08);
  return m;
}

function makeBody(scene: Scene, id: HeroId): Actor {
  const slim = id === "kleon";
  const height = slim ? 1.72 : 1.88;
  const radius = slim ? 0.22 : 0.34;
  const root = new TransformNode(id, scene);
  const mesh = MeshBuilder.CreateCapsule(id + "cap", { height, radius, tessellation: 8 }, scene);
  mesh.parent = root;
  mesh.position.y = height / 2;
  mesh.material = tint(scene, id + "mat", slim ? new Color3(0.84, 0.7, 0.48) : new Color3(0.36, 0.27, 0.2));
  const head = MeshBuilder.CreateSphere(id + "head", { diameter: slim ? 0.38 : 0.44, segments: 8 }, scene);
  head.parent = root;
  head.position.y = height + 0.02;
  head.material = mesh.material;
  root.position.set(slim ? -0.7 : 0.7, groundHeight(slim ? -0.7 : 0.7, 8), 8);
  return { id, root, mesh, vel: Vector3.Zero(), height, radius, speed: slim ? 6.4 : 5.1, inWater: false };
}

export function createActors(scene: Scene): {
  kleon: Actor;
  ariston: Actor;
  scroll: Mesh;
  markers: Map<string, Mesh>;
} {
  const kleon = makeBody(scene, "kleon");
  const ariston = makeBody(scene, "ariston");
  const scroll = MeshBuilder.CreateBox("scroll", { width: 0.18, height: 0.42, depth: 0.08 }, scene);
  scroll.material = tint(scene, "scrollMat", new Color3(0.72, 0.58, 0.32));
  const markers = new Map<string, Mesh>();
  return { kleon, ariston, scroll, markers };
}

export function placeMarkers(
  scene: Scene,
  markers: Map<string, Mesh>,
  events: { id: string; ribbonOrder: number }[],
): void {
  for (const [id, m] of markers) {
    m.dispose();
    markers.delete(id);
  }
  const mat = tint(scene, "mark", new Color3(0.95, 0.72, 0.28));
  mat.emissiveColor = new Color3(0.55, 0.35, 0.08);
  for (const ev of events) {
    const z = 8 + ev.ribbonOrder * 1.05;
    const disc = MeshBuilder.CreateCylinder(ev.id + "mark", { height: 0.12, diameter: 2.4 }, scene);
    disc.position.set(0, groundHeight(0, z) + 0.08, z);
    disc.material = mat;
    markers.set(ev.id, disc);
  }
}

function integrate(actor: Actor, wish: Vector3, dt: number, swim: boolean): void {
  const acc = swim ? actor.speed * 0.45 : actor.speed;
  actor.vel.x += wish.x * acc * dt * 4;
  actor.vel.z += wish.z * acc * dt * 4;
  const damp = swim ? 0.86 : 0.78;
  actor.vel.x *= Math.pow(damp, dt * 60);
  actor.vel.z *= Math.pow(damp, dt * 60);
  if (swim) {
    actor.vel.addInPlace(CURRENT.scale(dt));
    actor.vel.y = (WATER_Y - 0.35 - actor.root.position.y) * 4;
  } else {
    actor.vel.y -= 28 * dt;
  }
  actor.root.position.addInPlace(actor.vel.scale(dt));
  const gh = groundHeight(actor.root.position.x, actor.root.position.z);
  const minY = swim ? Math.max(gh, WATER_Y - 0.55) : gh;
  if (actor.root.position.y < minY) {
    actor.root.position.y = minY;
    actor.vel.y = 0;
  }
  actor.root.position.x = Math.max(-22, Math.min(22, actor.root.position.x));
  actor.root.position.z = Math.max(2, Math.min(120, actor.root.position.z));
  if (wish.lengthSquared() > 0.01) {
    const yaw = Math.atan2(wish.x, wish.z);
    actor.root.rotation.y += (yaw - actor.root.rotation.y) * Math.min(1, dt * 8);
  }
  actor.inWater = inRiver(actor.root.position.z, actor.root.position.y + 0.4);
}

export function stepActors(
  actors: { kleon: Actor; ariston: Actor; scroll: Mesh },
  leaderId: HeroId,
  input: InputState,
  dt: number,
  overlayOpen: boolean,
  carrying: boolean,
): { droppedScroll: boolean; leader: Actor } {
  const leader = leaderId === "kleon" ? actors.kleon : actors.ariston;
  const follower = leaderId === "kleon" ? actors.ariston : actors.kleon;
  const wish = new Vector3(input.strafe, 0, input.forward);
  if (wish.lengthSquared() > 1) wish.normalize();
  if (overlayOpen) {
    wish.set(0, 0, 0);
  }
  integrate(leader, wish, dt, inRiver(leader.root.position.z, leader.root.position.y + 0.3));
  const yaw = leader.root.rotation.y;
  const back = new Vector3(Math.sin(yaw) * -2.3, 0, Math.cos(yaw) * -2.3);
  const target = leader.root.position.add(back);
  const to = target.subtract(follower.root.position);
  to.y = 0;
  const followWish = to.length() > 1.4 ? to.normalize() : Vector3.Zero();
  integrate(follower, followWish, dt, inRiver(follower.root.position.z, follower.root.position.y + 0.3));

  let droppedScroll = false;
  if (carrying) {
    actors.scroll.setEnabled(true);
    actors.scroll.position.copyFrom(leader.root.position);
    actors.scroll.position.y += leader.height * 0.65;
    actors.scroll.position.addInPlace(new Vector3(Math.cos(yaw) * -0.28, 0, Math.sin(yaw) * 0.28));
    if (input.dropScroll && leader.inWater) droppedScroll = true;
  } else {
    actors.scroll.setEnabled(true);
  }
  return { droppedScroll, leader };
}

export function nearestEvent(
  markers: Map<string, Mesh>,
  leader: Actor,
  radius = 3.6,
): string | null {
  let best: string | null = null;
  let bestD = radius;
  for (const [id, mesh] of markers) {
    const d = Vector3.Distance(mesh.position, leader.root.position);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}
