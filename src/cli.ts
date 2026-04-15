#!/usr/bin/env node

/**
 * CLI entry point for Mindcase.
 *
 * Usage:
 *   mindcase mcp       Start the MCP server
 *   mindcase --version  Show version
 *   mindcase --help     Show help
 */

const args = process.argv.slice(2);
const command = args[0];

if (command === "mcp") {
  // Lazy import to avoid loading MCP dependencies unless needed
  import("./mcp/server.js").then((mod) => mod.startServer());
} else if (command === "--version" || command === "-v") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require("../package.json");
  console.log(`mindcase ${pkg.version}`);
} else {
  console.log(`Mindcase — 30+ data collection agents for structured web data.

Usage: mindcase <command>

Commands:
  mcp        Start the Mindcase MCP server for AI-powered data collection

Options:
  --version  Show version
  --help     Show this help

Add to Claude Code:
  claude mcp add mindcase -- npx mindcase mcp
`);
}
