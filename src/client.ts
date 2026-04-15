import {
  MindcaseError,
  AuthenticationError,
  InsufficientCreditsError,
  NotFoundError,
  ValidationError,
  RateLimitError,
} from "./errors.js";
import { AgentsNamespace, JobsNamespace, parseAgentPath } from "./namespaces.js";
import { Job, JobResults } from "./types.js";

const DEFAULT_BASE_URL = "https://api.mindcase.co/api/v1";
const DEFAULT_TIMEOUT = 30_000; // ms
const DEFAULT_POLL_INTERVAL = 3_000; // ms
const DEFAULT_RUN_TIMEOUT = 300_000; // ms
const ENV_KEY = "MINDCASE_API_KEY";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Client for the Mindcase Developer API.
 *
 * @example
 * ```typescript
 * import { Mindcase } from "mindcase";
 *
 * const client = new Mindcase({ apiKey: "mk_live_..." });
 * // Or set MINDCASE_API_KEY env var
 * const client = new Mindcase();
 *
 * // Discover agents
 * const agents = await client.agents.list("instagram");
 *
 * // Run an agent (blocks until results)
 * const results = await client.run("instagram/profiles", {
 *   params: { usernames: ["nike"] },
 * });
 * for (const row of results) {
 *   console.log(row["Username"], row["Followers"]);
 * }
 *
 * // Run async (returns immediately)
 * const job = await client.runAsync("instagram/profiles", {
 *   params: { usernames: ["nike"] },
 * });
 * console.log(job.id);
 * ```
 */
export class Mindcase {
  agents: AgentsNamespace;
  jobs: JobsNamespace;

  private _apiKey: string;
  private _baseUrl: string;
  private _timeout: number;
  private _pollInterval: number;
  private _runTimeout: number;

  constructor(options?: {
    apiKey?: string;
    baseUrl?: string;
    timeout?: number;
    pollInterval?: number;
    runTimeout?: number;
  }) {
    const apiKey = options?.apiKey ?? process.env[ENV_KEY];
    if (!apiKey) {
      throw new Error(
        "API key required. Pass apiKey option or set the MINDCASE_API_KEY environment variable."
      );
    }
    if (!apiKey.startsWith("mk_live_")) {
      throw new Error("API key must start with 'mk_live_'");
    }

    this._apiKey = apiKey;
    this._baseUrl = (options?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this._timeout = options?.timeout ?? DEFAULT_TIMEOUT;
    this._pollInterval = options?.pollInterval ?? DEFAULT_POLL_INTERVAL;
    this._runTimeout = options?.runTimeout ?? DEFAULT_RUN_TIMEOUT;

    this.agents = new AgentsNamespace(this);
    this.jobs = new JobsNamespace(this);
  }

  // ── Execution ────────────────────────────────────────────────────

  /**
   * Run an agent and wait for results (sync).
   *
   * @param agent - Agent path as "group/slug" (e.g., "instagram/profiles")
   * @param options - params, timeout, pollInterval, onStatus callback
   * @returns JobResults with status, rowCount, data. Iterable.
   */
  async run(
    agent: string,
    options: {
      params: Record<string, any>;
      timeout?: number;
      pollInterval?: number;
      onStatus?: (job: Job) => void;
    }
  ): Promise<JobResults> {
    const job = await this.runAsync(agent, { params: options.params });
    return this._wait(job.jobId, {
      timeout: options.timeout ?? this._runTimeout,
      pollInterval: options.pollInterval ?? this._pollInterval,
      onStatus: options.onStatus,
    });
  }

  /**
   * Start an agent job and return immediately.
   *
   * @param agent - Agent path as "group/slug" (e.g., "instagram/profiles")
   * @param options - params for the agent
   * @returns Job with jobId, agent, status, createdAt
   */
  async runAsync(
    agent: string,
    options: { params: Record<string, any> }
  ): Promise<Job> {
    const [group, slug] = parseAgentPath(agent);
    const data = await this._post(`/agents/${group}/${slug}/run`, {
      params: options.params,
    });
    return Job.fromResponse(data);
  }

  // ── Credits ──────────────────────────────────────────────────────

  /**
   * Get remaining credit balance.
   *
   * @returns Credits remaining (number)
   */
  async credits(): Promise<number> {
    const data = await this._get("/credits");
    return Number(data.credits_remaining ?? 0);
  }

  // ── Internal ─────────────────────────────────────────────────────

  private async _wait(
    jobId: string,
    options: {
      timeout: number;
      pollInterval: number;
      onStatus?: (job: Job) => void;
    }
  ): Promise<JobResults> {
    const start = Date.now();
    let status = "unknown";

    while (Date.now() - start < options.timeout) {
      const job = await this.jobs.get(jobId);
      status = job.status;

      if (options.onStatus) {
        options.onStatus(job);
      }

      if (status === "completed") {
        return this.jobs.results(jobId);
      }

      if (status === "failed" || status === "cancelled") {
        throw new MindcaseError(
          `Job ${status}: ${job.error ?? "Unknown error"}`,
          undefined,
          { job_id: jobId, status }
        );
      }

      await sleep(options.pollInterval);
    }

    throw new MindcaseError(
      `Job timed out after ${options.timeout}ms (last status: ${status})`
    );
  }

  // ── HTTP Helpers ─────────────────────────────────────────────────

  async _get(
    path: string,
    params?: Record<string, any>
  ): Promise<Record<string, any>> {
    let url = `${this._baseUrl}${path}`;
    if (params) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) {
          qs.set(k, String(v));
        }
      }
      const qsStr = qs.toString();
      if (qsStr) url += `?${qsStr}`;
    }

    return this._requestWithRetry(url, {
      method: "GET",
      headers: this._headers(),
    });
  }

  async _post(
    path: string,
    body: Record<string, any>
  ): Promise<Record<string, any>> {
    return this._requestWithRetry(`${this._baseUrl}${path}`, {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify(body),
    });
  }

  async _delete(path: string): Promise<Record<string, any>> {
    return this._requestWithRetry(`${this._baseUrl}${path}`, {
      method: "DELETE",
      headers: this._headers(),
    });
  }

  private static readonly _MAX_RETRIES = 3;
  private static readonly _RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

  private async _requestWithRetry(
    url: string,
    init: RequestInit
  ): Promise<Record<string, any>> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < Mindcase._MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(this._timeout),
        });

        if (!Mindcase._RETRYABLE_STATUS.has(response.status)) {
          return this._handleResponse(response);
        }

        lastError = new MindcaseError(`Server error ${response.status}`, response.status);
      } catch (err) {
        if (err instanceof MindcaseError) throw err;
        lastError = new MindcaseError(`Network error: ${(err as Error).message}`);
      }

      if (attempt < Mindcase._MAX_RETRIES - 1) {
        await sleep(Math.min(2 ** attempt * 1000, 8000));
      }
    }

    throw lastError ?? new MindcaseError("Request failed after retries");
  }

  private async _handleResponse(response: Response): Promise<Record<string, any>> {
    let data: Record<string, any>;
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.status >= 200 && response.status < 300) {
      return data;
    }

    const detail =
      data.detail ?? response.statusText ?? "Unknown error";

    switch (response.status) {
      case 401:
        throw new AuthenticationError(detail, 401, data);
      case 402:
        throw new InsufficientCreditsError(detail, 402, data);
      case 404:
        throw new NotFoundError(detail, 404, data);
      case 422:
        throw new ValidationError(detail, 422, data);
      case 429:
        throw new RateLimitError(detail, 429, data);
      default:
        throw new MindcaseError(detail, response.status, data);
    }
  }

  private _headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this._apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "mindcase-node/0.4.0",
    };
  }

  toString(): string {
    return `Mindcase(key=****)`;
  }
}
