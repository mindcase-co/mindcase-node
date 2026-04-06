# Mindcase Node.js SDK

Programmatic access to 34+ data collection agents. Zero runtime dependencies — uses native `fetch`.

## Install

```bash
npm install mindcase
```

Requires Node.js 18+ (for native `fetch` and `AbortSignal.timeout`).

## Quick Start

```typescript
import { Mindcase } from "mindcase";

// Uses MINDCASE_API_KEY env var, or pass apiKey directly
const client = new Mindcase();

// Discover agents
const agents = await client.agents.list("instagram");
console.log(agents);

// Get agent details + parameter schema
const agent = await client.agents.get("instagram/profiles");
console.log(agent.requiredParams);

// Run an agent (blocks until results)
const results = await client.run("instagram/profiles", {
  params: { usernames: ["nike"] },
});

for (const row of results) {
  console.log(row["Username"], row["Followers"]);
}

// Extract a single column
const followers = results.toList("Followers");

// Run async (returns immediately with a Job)
const job = await client.runAsync("instagram/profiles", {
  params: { usernames: ["nike"] },
});
console.log(job.id, job.status);

// Check job status later
const updated = await client.jobs.get(job.id);
if (updated.isDone) {
  const data = await client.jobs.results(job.id);
  console.log(data.rowCount, "rows");
}

// Check credits
const credits = await client.credits();
console.log(`${credits} credits remaining`);
```

## Error Handling

```typescript
import { Mindcase, AuthenticationError, InsufficientCreditsError } from "mindcase";

try {
  const results = await client.run("instagram/profiles", {
    params: { usernames: ["nike"] },
  });
} catch (err) {
  if (err instanceof AuthenticationError) {
    console.error("Invalid API key");
  } else if (err instanceof InsufficientCreditsError) {
    console.error("Not enough credits");
  }
}
```

## Status Callback

Monitor job progress with `onStatus`:

```typescript
const results = await client.run("instagram/profiles", {
  params: { usernames: ["nike", "adidas"] },
  onStatus: (job) => console.log(`Status: ${job.status}, rows: ${job.rowCount}`),
});
```

## Configuration

```typescript
const client = new Mindcase({
  apiKey: "mk_live_...",                           // or MINDCASE_API_KEY env var
  baseUrl: "https://api.mindcase.co/api/v1",      // default
  timeout: 30_000,                                  // HTTP timeout (ms)
  pollInterval: 3_000,                              // polling interval (ms)
  runTimeout: 300_000,                              // max wait for run() (ms)
});
```

## API Reference

| Method | Description |
|---|---|
| `client.agents.list(group?)` | List agents, optionally by group |
| `client.agents.get(path)` | Get agent details + parameters |
| `client.run(path, { params })` | Run agent, wait for results |
| `client.runAsync(path, { params })` | Start agent, return Job immediately |
| `client.jobs.list({ status?, limit? })` | List your jobs |
| `client.jobs.get(jobId)` | Get job status |
| `client.jobs.results(jobId)` | Get job results |
| `client.jobs.cancel(jobId)` | Cancel a running job |
| `client.credits()` | Get remaining credit balance |
