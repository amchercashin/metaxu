"""Small MCP handshake check. Pass --live to exercise Blender itself."""
import asyncio
import json
import os
from pathlib import Path
import sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parents[1]

async def main():
    env = dict(os.environ, DISABLE_TELEMETRY="true", BLENDER_MCP_DISABLE_TELEMETRY="true", PYTHONUTF8="1")
    server = StdioServerParameters(command="C:/Dev/Tools/blender-mcp/.venv/Scripts/blender-mcp.exe", env=env)
    async with stdio_client(server) as (read, write):
        async with ClientSession(read, write) as session:
            result = await session.initialize()
            tools = await session.list_tools()
            names = [tool.name for tool in tools.tools]
            assert "get_scene_info" in names and "execute_blender_code" in names
            report = {"server": result.serverInfo.model_dump(), "tool_count": len(names), "handshake": "passed", "live": "not requested"}
            if "--live" in sys.argv:
                reply = await session.call_tool("execute_blender_code", {
                    "code": "import bpy\nobj=bpy.data.objects.new('MetaxMcpProbe', None)\nbpy.context.scene.collection.objects.link(obj)\nassert bpy.data.objects.get('MetaxMcpProbe') is obj\nbpy.data.objects.remove(obj, do_unlink=True)\nprint('METAX_MCP_ROUNDTRIP_OK')",
                    "user_prompt": "Test the development environment with a temporary empty object and remove it."
                })
                response = str(reply)
                assert not reply.isError and "METAX_MCP_ROUNDTRIP_OK" in response, response
                report["live"] = "passed"
            out = ROOT / "artifacts" / "blender-mcp-check.json"
            out.parent.mkdir(exist_ok=True)
            out.write_text(json.dumps(report, indent=2), encoding="utf-8")
            print(json.dumps(report, indent=2))

asyncio.run(main())
