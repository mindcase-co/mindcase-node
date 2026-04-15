/**
 * Mindcase MCP Server — exposes 30+ data collection agents as Claude tools.
 *
 * Uses the Mindcase SDK client internally instead of raw HTTP calls.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Mindcase } from "../client.js";
import type { Agent, JobResults } from "../types.js";

// ── SDK client (lazy singleton) ────────────────────────────────────────────

let _client: Mindcase | null = null;

function getClient(): Mindcase {
  if (!_client) {
    _client = new Mindcase(); // reads MINDCASE_API_KEY from env
  }
  return _client;
}

// ── Tool registry ──────────────────────────────────────────────────────────

const registeredTools: Tool[] = [];
const toolHandlers = new Map<string, (args: Record<string, any>) => Promise<string>>();

function registerTool(
  name: string,
  description: string,
  inputSchema: { type: "object"; properties?: Record<string, any>; required?: string[] },
  handler: (args: Record<string, any>) => Promise<string>
): void {
  registeredTools.push({ name, description, inputSchema });
  toolHandlers.set(name, handler);
}

// ── Result formatting ──────────────────────────────────────────────────────

function formatResults(results: JobResults, jobId: string = "", maxRows: number = 10): string {
  if (!results.data || results.data.length === 0) {
    return jobId
      ? `**No results returned.** Job: \`${jobId}\``
      : "**No results returned.**";
  }

  const columns = results.columns;
  const rowCount = results.rowCount;
  const lines: string[] = [];

  if (jobId) {
    lines.push(`**${rowCount} rows** collected | Job: \`${jobId}\``);
  } else {
    lines.push(`**${rowCount} rows** collected`);
  }
  lines.push("");

  const show = results.data.slice(0, maxRows);
  const showCols = columns.slice(0, 6);
  lines.push("| " + showCols.join(" | ") + " |");
  lines.push("| " + showCols.map(() => "---").join(" | ") + " |");

  for (const row of show) {
    const vals = showCols.map((c) => String(row[c] ?? "").slice(0, 40));
    lines.push("| " + vals.join(" | ") + " |");
  }

  if (rowCount > maxRows) {
    lines.push(`\n*Showing ${maxRows} of ${rowCount} rows.*`);
  }

  if (columns.length > 6) {
    lines.push(`\n*Showing 6 of ${columns.length} columns: ${columns.join(", ")}*`);
  }

  return lines.join("\n");
}

// ── Utility tool helpers ───────────────────────────────────────────────────

function makeToolName(group: string, slug: string): string {
  return `${group}_${slug}`.replace(/-/g, "_");
}

// ── Register utility tools ─────────────────────────────────────────────────

registerTool(
  "list_agents",
  "List all available Mindcase data collection agents. Optionally filter by platform group (e.g. 'linkedin', 'instagram', 'amazon').",
  {
    type: "object",
    properties: {
      group: {
        type: "string",
        description: "Optional platform filter (e.g. 'linkedin', 'instagram', 'amazon'). If omitted, returns all agents.",
      },
    },
  },
  async (args) => {
    const client = getClient();
    const agents = await client.agents.list(args.group || undefined);

    if (!agents.length) {
      return args.group
        ? `No agents found for group '${args.group}'.`
        : "No agents found.";
    }

    const lines: string[] = [];
    let currentGroup: string | null = null;
    for (const a of agents) {
      if (a.group !== currentGroup) {
        currentGroup = a.group;
        lines.push(`\n## ${currentGroup}`);
      }
      lines.push(
        `  - **${a.name}** (\`${a.path}\`) — ${a.description.slice(0, 80)}... [${a.creditsPerRow} cr/row]`
      );
    }

    return `**${agents.length} agents available:**\n` + lines.join("\n");
  }
);

registerTool(
  "check_credits",
  "Check remaining Mindcase credit balance.",
  { type: "object", properties: {} },
  async () => {
    try {
      const client = getClient();
      const credits = await client.credits();
      return `**${credits.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}** credits remaining.`;
    } catch (e: any) {
      return `Error checking credits: ${e.message}`;
    }
  }
);

registerTool(
  "get_agent_details",
  "Get full details and required parameters for a specific agent. Use format 'group/slug' (e.g. 'instagram/profiles', 'google-maps/businesses').",
  {
    type: "object",
    properties: {
      agent_path: {
        type: "string",
        description: "Agent identifier in 'group/slug' format.",
      },
    },
    required: ["agent_path"],
  },
  async (args) => {
    const agentPath = args.agent_path as string;
    const parts = agentPath.split("/");
    if (parts.length !== 2) {
      return `Invalid agent path: '${agentPath}'. Use format 'group/slug'.`;
    }

    try {
      const client = getClient();
      const agent = await client.agents.get(agentPath);

      const lines = [
        `## ${agent.name}`,
        `**Path:** \`${agent.group}/${agent.slug}\``,
        `**Description:** ${agent.description}`,
        `**Credits:** ${agent.creditsPerRow} per row`,
        "",
        "### Parameters:",
      ];

      const params = agent.parameters;
      for (const [key, param] of Object.entries(params)) {
        const req = param.required ? "required" : "optional";
        let line = `  - \`${key}\` (${param.type}, ${req}): ${param.description}`;
        if (param.default !== null && param.default !== undefined) {
          line += ` [default: ${param.default}]`;
        }
        lines.push(line);
      }

      if (Object.keys(params).length === 0) {
        lines.push("  No parameters documented.");
      }

      return lines.join("\n");
    } catch (e: any) {
      return `Agent '${agentPath}' not found: ${e.message}`;
    }
  }
);

// ── Dynamic agent tool registration ────────────────────────────────────────

function registerAgentTool(agent: Agent): void {
  const toolName = makeToolName(agent.group, agent.slug);
  const description = `${agent.name}: ${agent.description} [${agent.creditsPerRow} credits/row]`;

  // Build JSON schema from Parameter objects
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, param] of Object.entries(agent.parameters)) {
    const prop: Record<string, any> = { description: param.description };

    if (param.type === "array") {
      prop.type = "array";
      prop.items = { type: "string" };
    } else if (param.type === "integer") {
      prop.type = "integer";
    } else if (param.type === "boolean") {
      prop.type = "boolean";
    } else {
      prop.type = "string";
    }

    if (param.options) {
      prop.enum = param.options.map((o) =>
        typeof o === "object" ? o.value ?? o : o
      );
    }
    if (param.default !== null && param.default !== undefined) {
      prop.default = param.default;
    }

    properties[key] = prop;
    if (param.required) {
      required.push(key);
    }
  }

  const inputSchema = {
    type: "object" as const,
    properties: {
      params: {
        type: "string",
        description: `JSON string of agent parameters.\n\nAvailable parameters:\n${JSON.stringify(properties, null, 2)}\nRequired: ${required.length ? required.join(", ") : "none"}`,
      },
    },
  };

  // Capture agent path in closure
  const agentPath = `${agent.group}/${agent.slug}`;

  registerTool(
    toolName,
    description,
    inputSchema,
    async (args) => {
      try {
        const params = args.params
          ? typeof args.params === "string"
            ? JSON.parse(args.params)
            : args.params
          : {};
        const client = getClient();
        // Use runAsync to get job ID, then poll for results
        const job = await client.runAsync(agentPath, { params });
        // Poll until completion
        let status = job.status;
        const start = Date.now();
        const timeout = 300_000; // 5 minutes
        const pollInterval = 3_000;
        while (Date.now() - start < timeout) {
          const current = await client.jobs.get(job.jobId);
          status = current.status;
          if (status === "completed") {
            const results = await client.jobs.results(job.jobId);
            return formatResults(results, job.jobId);
          }
          if (status === "failed" || status === "cancelled") {
            return `**Error:** Job ${status}: ${current.error ?? "Unknown error"}. Job: \`${job.jobId}\``;
          }
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }
        return `**Error:** Job timed out after ${timeout / 1000}s (last status: ${status}). Job: \`${job.jobId}\``;
      } catch (e: any) {
        if (e instanceof SyntaxError) {
          return `**Error:** Invalid JSON in params: ${args.params}`;
        }
        return `**Error running ${agentPath}:** ${e.message}`;
      }
    }
  );
}

async function registerAllAgents(): Promise<void> {
  try {
    const client = getClient();
    const agentSummaries = await client.agents.list();
    console.error(`[mindcase-mcp] Fetched ${agentSummaries.length} agents from API`);

    for (let i = 0; i < agentSummaries.length; i++) {
      const summary = agentSummaries[i];
      try {
        const agent = await client.agents.get(summary.path);
        registerAgentTool(agent);
        console.error(`[mindcase-mcp] Registered tool: ${makeToolName(agent.group, agent.slug)}`);
        // Respect rate limits during registration
        if ((i + 1) % 5 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (e: any) {
        console.error(`[mindcase-mcp] Skipped ${summary.path}: ${e.message}`);
      }
    }

    console.error(`[mindcase-mcp] Server ready with ${registeredTools.length} tools`);
  } catch (e: any) {
    console.error(`[mindcase-mcp] Failed to fetch agents: ${e.message}`);
  }
}

// ── Server setup ───────────────────────────────────────────────────────────

export async function startServer(): Promise<void> {
  // Register dynamic agent tools before starting server
  await registerAllAgents();

  const server = new Server(
    { name: "mindcase", version: "0.4.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: registeredTools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const handler = toolHandlers.get(request.params.name);
    if (!handler) {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      };
    }
    try {
      const result = await handler((request.params.arguments ?? {}) as Record<string, any>);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (e: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${e.message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
