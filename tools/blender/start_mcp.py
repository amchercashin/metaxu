"""Enable the installed Blender MCP add-on for this session on localhost."""
import bpy
import addon_utils

addon_utils.enable("blender_mcp", default_set=True, persistent=True)
bpy.context.preferences.addons["blender_mcp"].preferences.telemetry_consent = False
bpy.ops.wm.save_userpref()
bpy.context.scene.blendermcp_port = 9876
bpy.ops.blendermcp.start_server()
assert bpy.context.scene.blendermcp_server_running
print("METAX_BLENDER_MCP_READY localhost:9876")
