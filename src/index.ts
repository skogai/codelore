#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ROOT } from "./config.js";
import { ensureRoot } from "./utils.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  await ensureRoot();
  const transport = new StdioServerTransport();
  await buildServer().connect(transport);
  console.error(`codelore MCP server running on stdio (root: ${ROOT})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
