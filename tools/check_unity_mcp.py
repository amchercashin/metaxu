"""Short handshake and live editor read through the official Unity MCP server."""
import asyncio
import json
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parents[1]

async def main():
    server = StdioServerParameters(
        command="C:/Users/amche/AppData/Local/Microsoft/WindowsApps/unity.exe",
        args=["mcp", "--project-path", str(ROOT / "unity/Metaxu")],
    )
    async with stdio_client(server) as (read, write):
        async with ClientSession(read, write) as session:
            result = await session.initialize()
            tools = await session.list_tools()
            assert any(t.name == "editor_status" for t in tools.tools)
            reply = await session.call_tool("editor_status", {})
            assert not reply.isError, str(reply)
            report = {"server": result.serverInfo.model_dump(), "handshake": "passed",
                      "tool_count": len(tools.tools), "live": reply.model_dump()}
            out = ROOT / "artifacts/unity-mcp-check.json"
            out.parent.mkdir(exist_ok=True)
            out.write_text(json.dumps(report, indent=2), encoding="utf-8")
            print(json.dumps(report, indent=2))

asyncio.run(main())
