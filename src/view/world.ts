import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Scene } from "@babylonjs/core/scene";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";

export const RIVER_Z0 = 52;
export const RIVER_Z1 = 78;
export const WATER_Y = 1.15;
export const CURRENT = new Vector3(3.2, 0, 0);

export function groundHeight(x: number, z: number): number {
  const slope = z < 48 ? 7.2 * (1 - z / 48) : z > 80 ? 1.6 + 0.015 * (z - 80) : -0.55;
  const boulders = z < 46 ? 0.45 * Math.sin(x * 0.35 + z * 0.22) * Math.sin(z * 0.4) : 0;
  const bank = z > 78 && z < 88 ? 1.1 * Math.max(0, 1 - Math.abs(x) / 18) : 0;
  const fordDip = z > 62 && z < 72 ? -0.35 * Math.exp(-(x * x) / 28) : 0;
  return slope + boulders + bank + fordDip;
}

export function inRiver(z: number, y: number): boolean {
  return z > RIVER_Z0 && z < RIVER_Z1 && y < WATER_Y + 0.55;
}

export function eventZ(ribbonOrder: number): number {
  return 8 + ribbonOrder * 1.05;
}

function mat(scene: Scene, name: string, color: Color3, extras?: { alpha?: number; spec?: number }): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.specularColor = color.scale(extras?.spec ?? 0.08);
  m.emissiveColor = color.scale(0.04);
  if (extras?.alpha !== undefined) {
    m.alpha = extras.alpha;
    m.transparencyMode = 2;
  }
  m.fogEnabled = true;
  return m;
}

export function buildRibbonWorld(scene: Scene, physics: boolean): { water: Mesh; ground: Mesh } {
  scene.clearColor.set(0.72, 0.55, 0.38, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.78, 0.7, 0.58);
  scene.fogDensity = 0.012;

  const hemi = new HemisphericLight("sky", new Vector3(0.2, 1, 0.15), scene);
  hemi.intensity = 0.72;
  hemi.groundColor = new Color3(0.35, 0.22, 0.14);
  const sun = new DirectionalLight("sun", new Vector3(-0.45, -0.82, 0.3), scene);
  sun.intensity = 1.05;
  sun.diffuse = new Color3(1, 0.86, 0.62);
  sun.specular = new Color3(1, 0.9, 0.7);

  const sky = MeshBuilder.CreateSphere("sky", { diameter: 420, segments: 12, sideOrientation: Mesh.BACKSIDE }, scene);
  const skyMat = mat(scene, "skyMat", new Color3(0.62, 0.78, 0.9), { spec: 0 });
  skyMat.emissiveColor = new Color3(0.45, 0.62, 0.82);
  skyMat.disableLighting = true;
  sky.material = skyMat;

  const ground = MeshBuilder.CreateGround("ground", { width: 56, height: 140, subdivisions: 56 }, scene);
  ground.position.z = 55;
  const pos = ground.getVerticesData(VertexBuffer.PositionKind);
  if (pos) {
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const z = pos[i + 2] + ground.position.z;
      pos[i + 1] = groundHeight(x, z);
    }
    ground.updateVerticesData(VertexBuffer.PositionKind, pos);
    ground.createNormals(true);
  }
  ground.material = mat(scene, "sand", new Color3(0.62, 0.48, 0.32));
  ground.checkCollisions = true;

  const water = MeshBuilder.CreateBox("water", { width: 54, height: 2.4, depth: RIVER_Z1 - RIVER_Z0 }, scene);
  water.position.set(0, WATER_Y - 0.9, (RIVER_Z0 + RIVER_Z1) / 2);
  water.material = mat(scene, "waterMat", new Color3(0.18, 0.32, 0.38), { alpha: 0.42, spec: 0.4 });
  const waterFog = MeshBuilder.CreateBox("mist", { width: 54, height: 3.2, depth: 30 }, scene);
  waterFog.position.set(0, WATER_Y + 1.4, 64);
  waterFog.material = mat(scene, "mistMat", new Color3(0.82, 0.78, 0.7), { alpha: 0.12, spec: 0 });

  const stoneMat = mat(scene, "stone", new Color3(0.45, 0.32, 0.22));
  const warmStone = mat(scene, "warmStone", new Color3(0.7, 0.42, 0.22));
  for (let i = 0; i < 28; i++) {
    const b = MeshBuilder.CreateBox(`b${i}`, { width: 1.6 + (i % 5) * 0.4, height: 1.1 + (i % 3) * 0.7, depth: 1.4 + (i % 4) * 0.3 }, scene);
    const z = 4 + (i * 1.5) % 40;
    const x = ((i * 7) % 17) - 8;
    b.position.set(x, groundHeight(x, z) + 0.6, z);
    b.rotation.y = i * 0.4;
    b.material = i % 3 === 0 ? warmStone : stoneMat;
  }

  const trunkMat = mat(scene, "trunk", new Color3(0.32, 0.2, 0.12));
  const leafMat = mat(scene, "leaf", new Color3(0.28, 0.42, 0.22));
  for (let i = 0; i < 9; i++) {
    const z = 28 + i * 2.2;
    const x = i % 2 === 0 ? -11 : 12;
    const trunk = MeshBuilder.CreateCylinder(`p${i}`, { height: 5.4, diameter: 0.38 }, scene);
    trunk.position.set(x, groundHeight(x, z) + 2.5, z);
    trunk.material = trunkMat;
    const crown = MeshBuilder.CreateSphere(`c${i}`, { diameter: 3.2 }, scene);
    crown.position.set(x, groundHeight(x, z) + 5.4, z);
    crown.scaling.set(1.3, 0.55, 1.3);
    crown.material = leafMat;
  }

  const reedMat = mat(scene, "reed", new Color3(0.4, 0.45, 0.22));
  for (let i = 0; i < 40; i++) {
    const z = 48 + (i % 12) * 1.1;
    const x = (i % 2 === 0 ? -1 : 1) * (14 + (i % 5) * 0.4);
    const reed = MeshBuilder.CreateCylinder(`r${i}`, { height: 2.2, diameter: 0.07 }, scene);
    reed.position.set(x, groundHeight(x, z) + 1.1, z);
    reed.material = reedMat;
  }

  if (physics) {
    try {
      new PhysicsAggregate(ground, PhysicsShapeType.MESH, { mass: 0 }, scene);
    } catch {
      try {
        new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene);
      } catch {
        /* kinematic ground still works */
      }
    }
  }

  return { water, ground };
}
