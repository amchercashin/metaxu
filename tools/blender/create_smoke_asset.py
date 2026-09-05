"""Make a small authored mesh and export FBX for the environment smoke check."""
from pathlib import Path
import bpy

root = Path(__file__).resolve().parents[2]
source = root / "art" / "source" / "smoke"
target = root / "unity" / "Metaxu" / "Assets" / "Metax" / "Smoke" / "Models"
source.mkdir(parents=True, exist_ok=True)
target.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.5))
obj = bpy.context.object
obj.name = "BlenderSmokeMarker"
bevel = obj.modifiers.new("Soft edges", 'BEVEL')
bevel.width = 0.08
bevel.segments = 3
bpy.ops.object.modifier_apply(modifier=bevel.name)
material = bpy.data.materials.new("Warm terracotta")
material.diffuse_color = (0.55, 0.20, 0.09, 1.0)
obj.data.materials.append(material)
bpy.ops.wm.save_as_mainfile(filepath=str(source / "SmokeMarker.blend"))
bpy.ops.export_scene.fbx(
    filepath=str(target / "SmokeMarker.fbx"), use_selection=True,
    object_types={'MESH'}, apply_unit_scale=True, axis_forward='-Z', axis_up='Y',
    bake_anim=False, add_leaf_bones=False,
)
assert (target / "SmokeMarker.fbx").stat().st_size > 1000
print("METAX_BLENDER_EXPORT_OK")
