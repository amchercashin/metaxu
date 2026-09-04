import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { HDRCubeTexture } from "@babylonjs/core/Materials/Textures/hdrCubeTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";

export interface SurfaceSet {
  diffuse: string;
  normal: string;
  arm: string;
  metersWide: number;
}

interface PropPlacement {
  x: number;
  z: number;
  scale: number;
  rotation: number;
}

const assetRoot = `${import.meta.env.BASE_URL}assets/polyhaven`;
const generatedAssetRoot = `${import.meta.env.BASE_URL}assets/generated`;

export const coastalGroundSet: SurfaceSet = {
  diffuse: `${assetRoot}/materials/dry_ground_rocks/dry_ground_rocks_diff_1k.jpg`,
  normal: `${assetRoot}/materials/dry_ground_rocks/dry_ground_rocks_nor_gl_1k.jpg`,
  arm: `${assetRoot}/materials/dry_ground_rocks/dry_ground_rocks_arm_1k.jpg`,
  metersWide: 4,
};

export const roadSet: SurfaceSet = {
  diffuse: `${assetRoot}/materials/rock_path/rock_path_diff_1k.jpg`,
  normal: `${assetRoot}/materials/rock_path/rock_path_nor_gl_1k.jpg`,
  arm: `${assetRoot}/materials/rock_path/rock_path_arm_1k.jpg`,
  metersWide: 2,
};

export const weatheredStoneSet: SurfaceSet = {
  diffuse: `${assetRoot}/materials/old_stone_wall_02/old_stone_wall_02_diff_1k.jpg`,
  normal: `${assetRoot}/materials/old_stone_wall_02/old_stone_wall_02_nor_gl_1k.jpg`,
  arm: `${assetRoot}/materials/old_stone_wall_02/old_stone_wall_02_arm_1k.jpg`,
  metersWide: 2.085,
};

function tiledTexture(scene: Scene, url: string, uScale: number, vScale: number, gammaSpace: boolean): Texture {
  const texture = new Texture(url, scene, true, false);
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.uScale = uScale;
  texture.vScale = vScale;
  texture.gammaSpace = gammaSpace;
  texture.anisotropicFilteringLevel = 8;
  return texture;
}

export function createSurfaceMaterial(
  scene: Scene,
  name: string,
  set: SurfaceSet,
  uScale: number,
  vScale: number,
  tint: Color3,
): PBRMaterial {
  const material = new PBRMaterial(name, scene);
  material.albedoColor = tint;
  material.metallic = 0;
  material.roughness = 1;
  material.environmentIntensity = 0.82;
  material.albedoTexture = tiledTexture(scene, set.diffuse, uScale, vScale, true);
  material.bumpTexture = tiledTexture(scene, set.normal, uScale, vScale, false);
  material.bumpTexture.level = 0.72;
  material.metallicTexture = tiledTexture(scene, set.arm, uScale, vScale, false);
  material.useAmbientOcclusionFromMetallicTextureRed = true;
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = true;
  return material;
}

export function createAbderaEnvironment(scene: Scene): HDRCubeTexture {
  const environment = new HDRCubeTexture(
    `${assetRoot}/hdris/toposcope_sunset_1k.hdr`,
    scene,
    256,
    false,
    true,
    false,
    true,
  );
  environment.name = "toposcope-sunset-environment";
  environment.rotationY = 1.74;
  scene.environmentTexture = environment;
  scene.environmentIntensity = 0.72;
  return environment;
}

function placeContainerInstances(
  scene: Scene,
  shadow: ShadowGenerator,
  label: string,
  container: AssetContainer,
  placements: readonly PropPlacement[],
  groundHeight: (x: number, z: number) => number,
): void {
  placements.forEach((placement, index) => {
    const group = new TransformNode(`${label}-cluster-${index}`, scene);
    group.position.set(placement.x, groundHeight(placement.x, placement.z), placement.z);
    group.rotation.y = placement.rotation;
    group.scaling.setAll(placement.scale);
    const entries = container.instantiateModelsToScene(
      (sourceName) => `${label}-${index}-${sourceName}`,
      false,
      { doNotInstantiate: false },
    );
    for (const root of entries.rootNodes) root.parent = group;
    for (const mesh of group.getChildMeshes()) {
      mesh.isPickable = false;
      shadow.addShadowCaster(mesh);
    }
  });
}

const boulderPlacements: readonly PropPlacement[] = [
  { x: -13, z: -9, scale: 5.2, rotation: 0.2 },
  { x: -6, z: 11, scale: 3.3, rotation: 2.1 },
  { x: 10, z: -12, scale: 4.2, rotation: 4.4 },
  { x: 21, z: 11, scale: 2.8, rotation: 1.15 },
  { x: 34, z: -11, scale: 6, rotation: 3.5 },
  { x: 49, z: 11, scale: 3.7, rotation: 5.2 },
  { x: 56, z: -29, scale: 7, rotation: 0.78 },
  { x: 69, z: -43, scale: 4.6, rotation: 2.85 },
  { x: 78, z: 13, scale: 5.6, rotation: 4.8 },
];

const shrubPlacements: readonly PropPlacement[] = [
  { x: -11, z: 7.4, scale: 0.62, rotation: 0.14 },
  { x: 1, z: -7.2, scale: 0.5, rotation: 2.7 },
  { x: 15, z: 9.1, scale: 0.67, rotation: 3.8 },
  { x: 27, z: -7.8, scale: 0.58, rotation: 1.5 },
  { x: 41, z: 9.4, scale: 0.7, rotation: 5.35 },
  { x: 53, z: -9.2, scale: 0.55, rotation: 2.25 },
  { x: 58, z: -31, scale: 0.61, rotation: 0.9 },
  { x: 68, z: -40, scale: 0.7, rotation: 4.2 },
  { x: 75, z: 8.4, scale: 0.64, rotation: 3.05 },
];

const olivePlacements: readonly PropPlacement[] = [
  { x: -34, z: -27, scale: 1.02, rotation: 0.42 },
  { x: -29, z: 25, scale: 0.9, rotation: 1.85 },
  { x: 9, z: -31, scale: 1.08, rotation: 2.52 },
  { x: 18, z: 27, scale: 0.82, rotation: 4.12 },
  { x: 38, z: -27, scale: 1.16, rotation: 0.95 },
  { x: 47, z: 29, scale: 0.96, rotation: 3.24 },
  { x: 61, z: -18, scale: 0.86, rotation: 5.18 },
  { x: 73, z: 28, scale: 1.12, rotation: 1.36 },
  { x: 82, z: -43, scale: 0.92, rotation: 2.94 },
];

/**
 * Crossed planes keep the tree silhouettes light enough for the browser while
 * the opening region is still waiting for final authored vegetation models.
 */
export function createOliveImpostors(
  scene: Scene,
  shadow: ShadowGenerator,
  groundHeight: (x: number, z: number) => number,
): void {
  const texture = new Texture(`${generatedAssetRoot}/olive-tree-impostor-v1.webp`, scene, true, false);
  texture.hasAlpha = true;
  texture.gammaSpace = true;
  texture.anisotropicFilteringLevel = 8;

  const material = new PBRMaterial("olive-impostor-material", scene);
  material.albedoTexture = texture;
  material.useAlphaFromAlbedoTexture = true;
  material.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST;
  material.alphaCutOff = 0.52;
  material.backFaceCulling = false;
  material.metallic = 0;
  material.roughness = 0.94;
  material.environmentIntensity = 0.62;

  olivePlacements.forEach((placement, index) => {
    const root = new TransformNode(`olive-impostor-${index}`, scene);
    root.position.set(placement.x, groundHeight(placement.x, placement.z), placement.z);
    root.rotation.y = placement.rotation;
    root.scaling.setAll(placement.scale);
    for (let side = 0; side < 2; side += 1) {
      const plane = MeshBuilder.CreatePlane(`olive-impostor-${index}-${side}`, {
        width: 6.2,
        height: 6.2,
        sideOrientation: Mesh.DOUBLESIDE,
      }, scene);
      plane.parent = root;
      plane.position.y = 3.1;
      plane.rotation.y = side * Math.PI / 2;
      plane.material = material;
      plane.isPickable = false;
      plane.receiveShadows = true;
      shadow.addShadowCaster(plane);
    }
  });
}

export async function loadAbderaProps(
  scene: Scene,
  shadow: ShadowGenerator,
  groundHeight: (x: number, z: number) => number,
): Promise<void> {
  // These props are plain glTF 2.0. Load the v2 core on demand so first paint
  // does not wait for the model loader, glTF 1.0, or optional extensions.
  await import("@babylonjs/loaders/glTF/2.0/glTFLoader");
  const { LoadAssetContainerAsync } = await import("@babylonjs/core/Loading/sceneLoader");
  const [boulders, shrubs] = await Promise.all([
    LoadAssetContainerAsync(
      `${assetRoot}/models/namaqualand_boulders_01/namaqualand_boulders_01_1k.gltf`,
      scene,
    ),
    LoadAssetContainerAsync(`${assetRoot}/models/shrub_02/shrub_02_1k.gltf`, scene),
  ]);

  for (const mesh of [...boulders.meshes, ...shrubs.meshes]) mesh.receiveShadows = true;

  placeContainerInstances(scene, shadow, "boulder", boulders, boulderPlacements, groundHeight);
  placeContainerInstances(scene, shadow, "shrub", shrubs, shrubPlacements, groundHeight);
}
