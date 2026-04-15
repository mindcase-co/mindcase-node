# Mindcase Node.js SDK

[![npm version](https://img.shields.io/npm/v/mindcase.svg)](https://www.npmjs.com/package/mindcase)
[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](https://opensource.org/licenses/MIT)
[![Node.js 18+](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/)

Collect structured data from 30+ web sources with a single API call. The official Node.js SDK for [Mindcase](https://mindcase.co). Zero runtime dependencies.

```bash
npm install mindcase
```

## Quick Start

```typescript
import { Mindcase } from "mindcase";

const client = new Mindcase({ apiKey: "mk_live_..." });

const results = await client.run("instagram/profiles", {
  params: { usernames: ["nike", "adidas"] },
});

for (const row of results) {
  console.log(row["Username"], row["Followers"]);
}
```

## Supported Data Sources

| Platform | Agents | Use Cases |
|----------|--------|-----------|
| **LinkedIn** | Profiles, Companies, Employees, Jobs, Posts, People Search, Company Search, Domain Lookup | Lead generation, recruiting, market research |
| **Instagram** | Profiles, Posts, Comments | Influencer analysis, brand monitoring, engagement tracking |
| **YouTube** | Videos, Channels, Comments, Shorts | Content research, competitor analysis, audience insights |
| **Amazon** | Products, Reviews, Bestsellers | Price monitoring, product research, review analysis |
| **Google Maps** | Businesses, Reviews, Reverse Geocoding | Local business data, location intelligence, competitive analysis |
| **Twitter / X** | Posts | Social listening, trend tracking, sentiment analysis |
| **TikTok** | Profiles | Creator analytics, engagement benchmarking |
| **Reddit** | Posts, Comments | Community insights, brand sentiment, market research |
| **Shopify** | Products | Competitor pricing, product catalog extraction |
| **Indeed** | Jobs | Job market analysis, salary benchmarking |
| **App Store** | Reviews | App sentiment analysis, feature request mining |
| **Flipkart** | Products | Indian e-commerce pricing, product data |
| **Myntra** | Products | Fashion e-commerce data, trend analysis |

See all agents and parameters: [docs.mindcase.co/agents-overview](https://docs.mindcase.co/agents-overview)

## Features

- **30+ pre-built agents** across 15 platforms — no scraping infrastructure to manage
- **Sync and async** — block until results or fire-and-forget
- **Automatic polling** — `client.run()` handles job lifecycle for you
- **Fully typed** — TypeScript-first with complete type definitions
- **Zero dependencies** — uses native `fetch` (Node.js 18+)
- **Retry with backoff** — built-in resilience for transient failures
- **Credit tracking** — check your balance programmatically

## Usage

### Discover Agents

```typescript
// List all available agents
const agents = await client.agents.list();

// Filter by platform
const linkedinAgents = await client.agents.list("linkedin");

// Get agent details and required parameters
const agent = await client.agents.get("linkedin/profiles");
console.log(agent.requiredParams);
```

### Run Agents

```typescript
// Synchronous — blocks until results are ready
const results = await client.run("linkedin/company-search", {
  params: {
    queries: ["AI startups San Francisco"],
    maxResults: 50,
  },
});

console.log(`${results.rowCount} companies found`);
console.log(`${results.creditsUsed} credits used`);

for (const company of results) {
  console.log(company["name"], company["industry"]);
}

// Asynchronous — returns a Job immediately
const job = await client.runAsync("amazon/reviews", {
  params: {
    startUrls: [{ url: "https://www.amazon.com/dp/B0XXXXXXXXX" }],
  },
});
console.log(`Job ${job.id} started, status: ${job.status}`);
```

### Monitor Progress

```typescript
const results = await client.run("instagram/profiles", {
  params: { usernames: ["nike", "adidas"] },
  onStatus: (job) => console.log(`Status: ${job.status}, rows: ${job.rowCount}`),
});
```

### Manage Jobs

```typescript
// List recent jobs
const jobs = await client.jobs.list();

// Check status
const job = await client.jobs.get("job_abc123");
console.log(job.status); // "completed", "running", "failed"

// Get results
const results = await client.jobs.results("job_abc123");

// Cancel a running job
await client.jobs.cancel("job_abc123");
```

### Check Credits

```typescript
const balance = await client.credits();
console.log(`${balance} credits remaining`);
```

### Extract Data

```typescript
const results = await client.run("amazon/products", {
  params: { startUrls: [{ url: "https://www.amazon.com/s?k=keyboard" }] },
});

// Get a single column as an array
const prices = results.toList("price");

// Get all column names
const columns = results.columns();

// Convert to plain objects
const rows = results.toDicts();
```

### Error Handling

```typescript
import {
  Mindcase,
  AuthenticationError,
  InsufficientCreditsError,
  RateLimitError,
  ValidationError,
  NotFoundError,
} from "mindcase";

try {
  const results = await client.run("instagram/profiles", {
    params: { usernames: ["nike"] },
  });
} catch (err) {
  if (err instanceof AuthenticationError) {
    console.error("Invalid API key");
  } else if (err instanceof InsufficientCreditsError) {
    console.error("Not enough credits");
  } else if (err instanceof RateLimitError) {
    console.error("Too many requests — slow down");
  }
}
```

## Configuration

```typescript
const client = new Mindcase({
  apiKey: "mk_live_...",                          // or set MINDCASE_API_KEY env var
  baseUrl: "https://api.mindcase.co/api/v1",     // default
  timeout: 30_000,                                 // HTTP request timeout in ms
  pollInterval: 3_000,                             // job polling interval in ms
  runTimeout: 300_000,                              // max wait for run() in ms
});
```

## Get Your API Key

Sign up at [app.mindcase.co](https://app.mindcase.co) and create an API key in the API Console.

## MCP Server (Claude Integration)

This package includes a built-in MCP server that exposes all 30+ agents as Claude tools.

**Add to Claude Code:**

```bash
claude mcp add mindcase -- npx mindcase mcp
```

**Add to Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "mindcase": {
      "command": "npx",
      "args": ["mindcase", "mcp"],
      "env": {
        "MINDCASE_API_KEY": "mk_live_..."
      }
    }
  }
}
```

Then ask Claude: *"Find the top 10 AI startups on LinkedIn"* or *"Get reviews for this Amazon product"*.

## Also Available

- **[Python SDK](https://pypi.org/project/mindcase/)** — `pip install mindcase` for Python (also includes MCP server via `mindcase mcp`)

## Documentation

- [API Documentation](https://docs.mindcase.co)
- [Agent Reference](https://docs.mindcase.co/agents-overview)
- [Authentication](https://docs.mindcase.co/authentication)
- [Node.js SDK Guide](https://docs.mindcase.co/sdk/node)
- [MCP Server Guide](https://docs.mindcase.co/sdk/mcp)
- [Python SDK Guide](https://docs.mindcase.co/sdk/python)

## License

MIT
