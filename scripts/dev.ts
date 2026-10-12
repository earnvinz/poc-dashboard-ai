import { spawn } from "node:child_process";

// const mcp = spawn(process.execPath, ['apps/mcp-server/server.ts'], { stdio: 'inherit' });
const gateway = spawn(process.execPath, ["apps/gateway/server.ts"], {
  stdio: "inherit",
});
for (const child of [gateway]) child.on("exit", () => process.exit());
// for (const child of [mcp, gateway]) child.on("exit", () => process.exit());
process.on("SIGINT", () => {
  //   mcp.kill();
  gateway.kill();
});
