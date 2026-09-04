import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import "@babylonjs/core/Engines/Extensions/engine.dynamicTexture";
import "@babylonjs/core/Engines/WebGPU/Extensions/engine.dynamicTexture";
// Vite can otherwise compile Babylon's first WebGPU frame before these lazy
// shader imports have populated ShaderStore, causing Babylon to fetch *.fx
// URLs (and receive index.html from the SPA fallback). Preload the material and
// shadow shaders used by this world so its first frame is deterministic.
import "@babylonjs/core/Shaders/default.fragment";
import "@babylonjs/core/Shaders/default.vertex";
import "@babylonjs/core/Shaders/imageProcessing.fragment";
import "@babylonjs/core/Shaders/pbr.fragment";
import "@babylonjs/core/Shaders/pbr.vertex";
import "@babylonjs/core/Shaders/postprocess.vertex";
import "@babylonjs/core/Shaders/rgbdDecode.fragment";
import "@babylonjs/core/Shaders/shadowMap.fragment";
import "@babylonjs/core/Shaders/shadowMap.vertex";
import "@babylonjs/core/ShadersWGSL/default.fragment";
import "@babylonjs/core/ShadersWGSL/default.vertex";
import "@babylonjs/core/ShadersWGSL/imageProcessing.fragment";
import "@babylonjs/core/ShadersWGSL/pbr.fragment";
import "@babylonjs/core/ShadersWGSL/pbr.vertex";
import "@babylonjs/core/ShadersWGSL/postprocess.vertex";
import "@babylonjs/core/ShadersWGSL/rgbdDecode.fragment";
import "@babylonjs/core/ShadersWGSL/shadowMap.fragment";
import "@babylonjs/core/ShadersWGSL/shadowMap.vertex";
import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import {
  coastalGroundSet,
  createAbderaEnvironment,
  createOliveImpostors,
  createSurfaceMaterial,
  loadAbderaProps,
  roadSet,
  weatheredStoneSet,
} from "./visualAssets";

export interface AbderaLandmarkAnchor {
  id: string;
  title: string;
  description: string;
  position: Vector3;
  interactionRadius: number;
}

export interface AbderaWorld {
  ground: Mesh;
  shadow: ShadowGenerator;
  sun: DirectionalLight;
  environmentReady: Promise<void>;
  landmarks: AbderaLandmarkAnchor[];
  encounterRoot: TransformNode;
  spawn: Vector3;
}

const WORLD_HALF = 104;
const SEA_LINE = 70;
const materialCache = new WeakMap<Scene, Map<string, PBRMaterial>>();

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hash2(x: number, z: number): number {
  let value = Math.imul(Math.floor(x * 97), 0x45d9f3b) ^ Math.imul(Math.floor(z * 89), 0x119de1f3);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smoothstep(0, 1, x - ix);
  const fz = smoothstep(0, 1, z - iz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  const ab = a + (b - a) * fx;
  const cd = c + (d - c) * fx;
  return ab + (cd - ab) * fz;
}

function fractalNoise(x: number, z: number): number {
  return valueNoise(x * 0.045, z * 0.045) * 0.56
    + valueNoise(x * 0.11 + 31, z * 0.11 - 17) * 0.29
    + valueNoise(x * 0.27 - 9, z * 0.27 + 41) * 0.15;
}

export function abderaGroundHeight(x: number, z: number): number {
  const coastalBase = 1.4 - smoothstep(52, SEA_LINE + 5, z) * 2.8;
  const northernHills = smoothstep(-22, -96, z) * (7 + 5 * valueNoise(x * 0.025, z * 0.022));
  const westernRise = smoothstep(50, 98, Math.abs(x)) * 2.8;
  const undulation = (fractalNoise(x, z) - 0.5) * (1.15 + northernHills * 0.18);
  const roadZ = Math.sin((x + 8) * 0.035) * 3.2;
  const roadFlatten = Math.max(0, 1 - Math.abs(z - roadZ) / 5.5);
  const natural = coastalBase + northernHills + westernRise + undulation;
  return natural * (1 - roadFlatten * 0.62) + 1.05 * roadFlatten;
}

function pbr(scene: Scene, name: string, color: Color3, roughness = 0.82, metallic = 0): PBRMaterial {
  let sceneMaterials = materialCache.get(scene);
  if (!sceneMaterials) {
    sceneMaterials = new Map();
    materialCache.set(scene, sceneMaterials);
  }
  const cached = sceneMaterials.get(name);
  if (cached) return cached;
  const material = new PBRMaterial(name, scene);
  material.albedoColor = color;
  material.roughness = roughness;
  material.metallic = metallic;
  material.environmentIntensity = 0.75;
  sceneMaterials.set(name, material);
  return material;
}

function makeNoiseTexture(scene: Scene, name: string, normal = false): DynamicTexture {
  const size = 256;
  const texture = new DynamicTexture(name, { width: size, height: size }, scene, false);
  const context = texture.getContext();
  const image = new ImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const broad = valueNoise(x * 0.09, y * 0.09);
      const fine = valueNoise(x * 0.31 + 13, y * 0.31 - 7);
      if (normal) {
        const dx = valueNoise((x + 1) * 0.12, y * 0.12) - valueNoise((x - 1) * 0.12, y * 0.12);
        const dy = valueNoise(x * 0.12, (y + 1) * 0.12) - valueNoise(x * 0.12, (y - 1) * 0.12);
        image.data[i] = 128 + Math.round(dx * 88);
        image.data[i + 1] = 128 + Math.round(dy * 88);
        image.data[i + 2] = 236;
      } else {
        const value = Math.round(88 + broad * 76 + fine * 25);
        image.data[i] = value + 16;
        image.data[i + 1] = value + 5;
        image.data[i + 2] = Math.max(0, value - 14);
      }
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  texture.update(false);
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.uScale = 28;
  texture.vScale = 28;
  return texture;
}

function buildRoad(scene: Scene): Mesh {
  const left: Vector3[] = [];
  const right: Vector3[] = [];
  for (let x = -24; x <= 99; x += 3) {
    const z = Math.sin((x + 8) * 0.035) * 3.2;
    const y = abderaGroundHeight(x, z) + 0.045;
    left.push(new Vector3(x, y, z - 2.25));
    right.push(new Vector3(x, y, z + 2.25));
  }
  const road = MeshBuilder.CreateRibbon("east-road", { pathArray: [left, right], closeArray: false, closePath: false }, scene);
  const roadMaterial = createSurfaceMaterial(
    scene,
    "road-rock-path",
    roadSet,
    42,
    2.2,
    new Color3(0.86, 0.72, 0.55),
  );
  road.material = roadMaterial;
  road.receiveShadows = true;
  return road;
}

function buildAbderaGate(scene: Scene, shadow: ShadowGenerator): TransformNode {
  const root = new TransformNode("abdera-gate", scene);
  root.position.set(-18, abderaGroundHeight(-18, 0), 0);
  const limestone = createSurfaceMaterial(
    scene,
    "abdera-weathered-masonry",
    weatheredStoneSet,
    5,
    3,
    new Color3(0.94, 0.84, 0.68),
  );
  for (const side of [-1, 1]) {
    const tower = MeshBuilder.CreateCylinder("gate-tower", { height: 8.2, diameter: 5.8, tessellation: 12 }, scene);
    tower.parent = root;
    tower.position.set(0, 4.1, side * 5.1);
    tower.material = limestone;
    tower.receiveShadows = true;
    shadow.addShadowCaster(tower);
    for (let i = 0; i < 4; i += 1) {
      const tooth = MeshBuilder.CreateBox("merlon", { width: 1.1, height: 1.1, depth: 1.1 }, scene);
      tooth.parent = root;
      const angle = (i / 4) * Math.PI * 2;
      tooth.position.set(Math.cos(angle) * 2.1, 8.25, side * 5.1 + Math.sin(angle) * 2.1);
      tooth.material = limestone;
      shadow.addShadowCaster(tooth);
    }
  }
  const lintel = MeshBuilder.CreateBox("gate-lintel", { width: 2.8, height: 2.1, depth: 5.1 }, scene);
  lintel.parent = root;
  lintel.position.set(0, 7.1, 0);
  lintel.material = limestone;
  shadow.addShadowCaster(lintel);
  const sideWallA = MeshBuilder.CreateBox("city-wall-a", { width: 4.2, height: 6.2, depth: 34 }, scene);
  sideWallA.parent = root;
  sideWallA.position.set(-1.8, 3.1, -24);
  sideWallA.material = limestone;
  const sideWallB = sideWallA.clone("city-wall-b");
  sideWallB.position.z = 24;
  for (const wall of [sideWallA, sideWallB]) {
    wall.receiveShadows = true;
    shadow.addShadowCaster(wall);
  }
  return root;
}

function buildRuinedShrine(scene: Scene, shadow: ShadowGenerator, position: Vector3): TransformNode {
  const root = new TransformNode("road-shrine", scene);
  root.position.copyFrom(position);
  const stone = createSurfaceMaterial(
    scene,
    "shrine-weathered-masonry",
    weatheredStoneSet,
    3,
    3,
    new Color3(0.92, 0.85, 0.72),
  );
  const base = MeshBuilder.CreateBox("shrine-base", { width: 8.2, depth: 6.5, height: 0.55 }, scene);
  base.parent = root;
  base.position.y = 0.28;
  base.material = stone;
  base.receiveShadows = true;
  for (const [x, z, height] of [[-2.7, -1.8, 4.7], [2.7, -1.8, 3.15], [-2.7, 1.8, 2.1]] as const) {
    const column = MeshBuilder.CreateCylinder("broken-column", {
      height,
      diameter: 0.7,
      tessellation: 12,
    }, scene);
    column.parent = root;
    column.position.set(x, 0.55 + height / 2, z);
    column.material = stone;
    shadow.addShadowCaster(column);
  }
  const fallen = MeshBuilder.CreateCylinder("fallen-column", { height: 4.2, diameter: 0.72, tessellation: 12 }, scene);
  fallen.parent = root;
  fallen.position.set(1.1, 0.85, 1.55);
  fallen.rotation.z = Math.PI / 2;
  fallen.rotation.y = 0.36;
  fallen.material = stone;
  shadow.addShadowCaster(fallen);
  return root;
}

function buildSea(scene: Scene): Mesh {
  const sea = MeshBuilder.CreateGround("aegean", { width: 250, height: 92, subdivisions: 2 }, scene);
  sea.position.set(0, -0.58, SEA_LINE + 43);
  const water = pbr(scene, "aegean-water", new Color3(0.035, 0.16, 0.22), 0.14, 0.08);
  water.alpha = 0.93;
  water.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
  water.indexOfRefraction = 1.333;
  water.microSurface = 0.92;
  const bump = makeNoiseTexture(scene, "sea-normal", true);
  bump.uScale = 18;
  bump.vScale = 9;
  bump.level = 0.25;
  water.bumpTexture = bump;
  sea.material = water;
  sea.receiveShadows = false;
  scene.onBeforeRenderObservable.add(() => {
    const t = performance.now() * 0.000008;
    bump.uOffset = t;
    bump.vOffset = -t * 0.55;
  });
  return sea;
}

function buildSky(scene: Scene): Mesh {
  const sky = MeshBuilder.CreateSphere("sky", { diameter: 560, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  const texture = new DynamicTexture("sky-gradient", { width: 16, height: 512 }, scene, false);
  const context = texture.getContext();
  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#577996");
  gradient.addColorStop(0.36, "#96aebe");
  gradient.addColorStop(0.68, "#e3b584");
  gradient.addColorStop(1, "#fae3b6");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 16, 512);
  texture.update(false);
  const material = new StandardMaterial("sky-material", scene);
  material.emissiveTexture = texture;
  material.diffuseTexture = texture;
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.fogEnabled = false;
  sky.material = material;
  sky.infiniteDistance = true;
  sky.isPickable = false;
  return sky;
}

function buildDistantHills(scene: Scene): void {
  const back = pbr(scene, "distant-hills-back", new Color3(0.15, 0.18, 0.17), 1);
  const front = pbr(scene, "distant-hills-front", new Color3(0.2, 0.22, 0.18), 1);
  const hills = [
    { x: 178, z: -76, y: -14, sx: 70, sy: 31, sz: 67, material: back },
    { x: 183, z: 45, y: -16, sx: 76, sy: 34, sz: 72, material: back },
    { x: 145, z: -88, y: -11, sx: 55, sy: 24, sz: 58, material: front },
    { x: 148, z: 2, y: -13, sx: 62, sy: 27, sz: 52, material: front },
    { x: 143, z: 83, y: -12, sx: 51, sy: 23, sz: 54, material: front },
  ] as const;

  hills.forEach((hill, index) => {
    const mesh = MeshBuilder.CreateIcoSphere(`distant-hill-${index}`, {
      radius: 1,
      subdivisions: 5,
    }, scene);
    mesh.position.set(hill.x, hill.y, hill.z);
    mesh.scaling.set(hill.sx, hill.sy, hill.sz);
    mesh.material = hill.material;
    mesh.isPickable = false;
    mesh.receiveShadows = false;
  });
}

export function buildAbderaWorld(scene: Scene, camera: ArcRotateCamera): AbderaWorld {
  scene.clearColor = new Color4(0.08, 0.12, 0.15, 1);
  scene.ambientColor = new Color3(0.18, 0.2, 0.18);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.49, 0.52, 0.48);
  scene.fogDensity = 0.0042;

  const hemi = new HemisphericLight("dawn-fill", new Vector3(0.16, 1, 0.2), scene);
  hemi.intensity = 0.72;
  hemi.diffuse = new Color3(0.54, 0.66, 0.72);
  hemi.groundColor = new Color3(0.28, 0.17, 0.1);

  const sun = new DirectionalLight("low-sun", new Vector3(-0.62, -0.72, 0.34), scene);
  sun.position.set(72, 92, -64);
  sun.intensity = 3.1;
  sun.diffuse = new Color3(1, 0.72, 0.43);
  sun.specular = new Color3(1, 0.8, 0.56);
  const shadow = new ShadowGenerator(2048, sun);
  shadow.usePercentageCloserFiltering = true;
  shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadow.bias = 0.00055;
  shadow.normalBias = 0.03;

  const ground = MeshBuilder.CreateGround("abdera-ground", {
    width: WORLD_HALF * 2,
    height: WORLD_HALF * 2,
    subdivisions: 132,
    updatable: false,
  }, scene);
  const positions = ground.getVerticesData(VertexBuffer.PositionKind);
  if (positions) {
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] = abderaGroundHeight(positions[i], positions[i + 2]);
    }
    ground.updateVerticesData(VertexBuffer.PositionKind, positions);
    ground.createNormals(true);
  }
  const groundMaterial = createSurfaceMaterial(
    scene,
    "coastal-earth",
    coastalGroundSet,
    WORLD_HALF * 2 / coastalGroundSet.metersWide,
    WORLD_HALF * 2 / coastalGroundSet.metersWide,
    new Color3(0.74, 0.62, 0.46),
  );
  ground.material = groundMaterial;
  ground.receiveShadows = true;
  ground.checkCollisions = true;

  const environmentReady = createAbderaEnvironment(scene);
  buildSky(scene);
  buildDistantHills(scene);
  buildSea(scene);
  buildRoad(scene);
  buildAbderaGate(scene, shadow);

  const shrinePosition = new Vector3(62, abderaGroundHeight(62, -36), -36);
  const encounterRoot = buildRuinedShrine(scene, shadow, shrinePosition);

  createOliveImpostors(scene, shadow, abderaGroundHeight);
  void loadAbderaProps(scene, shadow, abderaGroundHeight).catch((error: unknown) => {
    console.warn("Photogrammetry props could not be loaded; procedural world remains playable.", error);
  });

  // Image processing is applied inside the material shaders. Keeping it out of
  // a full-screen post-process chain avoids a Babylon 9/WebGPU startup race in
  // Vite while preserving the cinematic curve and vignette.
  const image = scene.imageProcessingConfiguration;
  image.toneMappingEnabled = true;
  image.toneMappingType = 1;
  image.exposure = 1.1;
  image.contrast = 1.13;
  image.vignetteEnabled = true;
  image.vignetteWeight = 1.15;
  image.vignetteColor = new Color4(0.05, 0.035, 0.02, 0);

  const landmarks: AbderaLandmarkAnchor[] = [
    {
      id: "abdera-polis",
      title: "Ворота Абдеры",
      description: "За стеной осталась школа. Восточная дорога начинается без фанфар.",
      position: new Vector3(-10, abderaGroundHeight(-10, 0), 0),
      interactionRadius: 10,
    },
    {
      id: "road-shrine",
      title: "Разорённое святилище",
      description: "У колонн видны свежие следы. Здесь дорога впервые спросит, кто вы такие.",
      position: shrinePosition,
      interactionRadius: 8,
    },
    {
      id: "east-road-marker",
      title: "Восточный межевой камень",
      description: "Дальше дорога раздваивается: к морю и к царской дороге.",
      position: new Vector3(81, abderaGroundHeight(81, 1), 1),
      interactionRadius: 8,
    },
    {
      id: "thracian-lookout",
      title: "Высота над Абдерой",
      description: "Отсюда впервые виден регион, а не только следующий шаг.",
      position: new Vector3(0, abderaGroundHeight(0, -72), -72),
      interactionRadius: 9,
    },
    {
      id: "abdera-harbor",
      title: "Гавань Абдеры",
      description: "Море обещает быстрый путь и цену, которую ещё никто не назвал.",
      position: new Vector3(42, abderaGroundHeight(42, 67), 67),
      interactionRadius: 10,
    },
  ];

  return {
    ground,
    shadow,
    sun,
    environmentReady,
    landmarks,
    encounterRoot,
    spawn: new Vector3(-2, abderaGroundHeight(-2, 0), 0),
  };
}
