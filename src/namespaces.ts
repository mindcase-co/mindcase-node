import type { Mindcase } from "./client.js";
import { Agent, AgentSummary, Job, JobResults } from "./types.js";

/** Parse 'group/slug' into [group, slug]. */
export function parseAgentPath(agent: string): [string, string] {
  const parts = agent.split("/", 2);
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Agent path must be 'group/slug', got: '${agent}'`);
  }
  return [parts[0], parts[1]];
}

/** Agent discovery operations: client.agents.* */
export class AgentsNamespace {
  private _client: Mindcase;

  constructor(client: Mindcase) {
    this._client = client;
  }

  /**
   * List agents, optionally filtered by group.
   *
   * @param group - Filter to a specific group (e.g., "instagram").
   *                If omitted, returns all agents across all groups.
   */
  async list(group?: string): Promise<AgentSummary[]> {
    if (group) {
      const data = await this._client._get(`/agents/${group}`);
      return (data.agents ?? []).map((a: Record<string, any>) =>
        AgentSummary.fromResponse({ ...a, group })
      );
    } else {
      const data = await this._client._get("/agents/all");
      return (data.agents ?? []).map((a: Record<string, any>) =>
        AgentSummary.fromResponse(a)
      );
    }
  }

  /**
   * Get agent details including parameter schema.
   *
   * @param agent - Agent path as "group/slug" (e.g., "instagram/profiles")
   */
  async get(agent: string): Promise<Agent> {
    const [group, slug] = parseAgentPath(agent);
    const data = await this._client._get(`/agents/${group}/${slug}`);
    return Agent.fromResponse(data);
  }
}

/** Job management operations: client.jobs.* */
export class JobsNamespace {
  private _client: Mindcase;

  constructor(client: Mindcase) {
    this._client = client;
  }

  /**
   * List your jobs.
   *
   * @param options - Optional filters: status, limit
   */
  async list(options?: {
    status?: string;
    limit?: number;
  }): Promise<Job[]> {
    const params: Record<string, any> = { limit: options?.limit ?? 20 };
    if (options?.status) {
      params.status = options.status;
    }
    const data = await this._client._get("/jobs", params);
    return (data.jobs ?? []).map((j: Record<string, any>) =>
      Job.fromResponse(j)
    );
  }

  /**
   * Get job status.
   *
   * @param jobId - Job ID
   */
  async get(jobId: string): Promise<Job> {
    const data = await this._client._get(`/jobs/${jobId}`);
    return Job.fromResponse(data);
  }

  /**
   * Get job results (collected data).
   *
   * @param jobId - Job ID
   */
  async results(jobId: string): Promise<JobResults> {
    const data = await this._client._get(`/jobs/${jobId}/results`);
    return JobResults.fromResponse(data);
  }

  /**
   * Cancel a running job. Credits are not charged for cancelled jobs.
   *
   * @param jobId - Job ID to cancel
   */
  async cancel(jobId: string): Promise<Job> {
    const data = await this._client._delete(`/jobs/${jobId}`);
    return Job.fromResponse(data);
  }
}
