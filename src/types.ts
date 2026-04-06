/** Agent parameter definition. */
export class Parameter {
  name: string;
  key: string;
  type: string;
  required: boolean;
  description: string;
  default: any;
  options: Array<Record<string, string>> | null;

  constructor(fields: {
    name: string;
    key: string;
    type: string;
    required?: boolean;
    description?: string;
    default?: any;
    options?: Array<Record<string, string>> | null;
  }) {
    this.name = fields.name;
    this.key = fields.key;
    this.type = fields.type;
    this.required = fields.required ?? false;
    this.description = fields.description ?? "";
    this.default = fields.default ?? null;
    this.options = fields.options ?? null;
  }

  static fromResponse(key: string, data: Record<string, any>): Parameter {
    return new Parameter({
      key,
      name: data.name ?? key,
      type: data.type ?? "string",
      required: data.required ?? false,
      description: data.description ?? "",
      default: data.default ?? null,
      options: data.options ?? null,
    });
  }

  toString(): string {
    const req = this.required ? " (required)" : "";
    return `Parameter(${this.key}: ${this.type}${req})`;
  }
}

/** Agent summary returned by agents.list(). */
export class AgentSummary {
  group: string;
  slug: string;
  name: string;
  description: string;
  creditsPerRow: number;

  constructor(fields: {
    group: string;
    slug: string;
    name: string;
    description: string;
    creditsPerRow: number;
  }) {
    this.group = fields.group;
    this.slug = fields.slug;
    this.name = fields.name;
    this.description = fields.description;
    this.creditsPerRow = fields.creditsPerRow;
  }

  /** Agent path as 'group/slug'. */
  get path(): string {
    return `${this.group}/${this.slug}`;
  }

  static fromResponse(data: Record<string, any>): AgentSummary {
    return new AgentSummary({
      group: data.group ?? "",
      slug: data.slug ?? "",
      name: data.name ?? "",
      description: data.description ?? "",
      creditsPerRow: data.credits_per_row ?? 1,
    });
  }

  toString(): string {
    return `Agent(${this.path} — ${this.creditsPerRow} credits/row)`;
  }
}

/** Full agent details with parameter schema. */
export class Agent {
  group: string;
  slug: string;
  name: string;
  description: string;
  creditsPerRow: number;
  parameters: Record<string, Parameter>;

  constructor(fields: {
    group: string;
    slug: string;
    name: string;
    description: string;
    creditsPerRow: number;
    parameters?: Record<string, Parameter>;
  }) {
    this.group = fields.group;
    this.slug = fields.slug;
    this.name = fields.name;
    this.description = fields.description;
    this.creditsPerRow = fields.creditsPerRow;
    this.parameters = fields.parameters ?? {};
  }

  /** Only the required parameters. */
  get requiredParams(): Record<string, Parameter> {
    const result: Record<string, Parameter> = {};
    for (const [k, v] of Object.entries(this.parameters)) {
      if (v.required) result[k] = v;
    }
    return result;
  }

  /** Only the optional parameters. */
  get optionalParams(): Record<string, Parameter> {
    const result: Record<string, Parameter> = {};
    for (const [k, v] of Object.entries(this.parameters)) {
      if (!v.required) result[k] = v;
    }
    return result;
  }

  static fromResponse(data: Record<string, any>): Agent {
    const params: Record<string, Parameter> = {};
    for (const [key, info] of Object.entries(data.parameters ?? {})) {
      params[key] = Parameter.fromResponse(key, info as Record<string, any>);
    }
    return new Agent({
      group: data.group ?? "",
      slug: data.slug ?? "",
      name: data.name ?? "",
      description: data.description ?? "",
      creditsPerRow: data.credits_per_row ?? 1,
      parameters: params,
    });
  }

  toString(): string {
    const req = Object.values(this.parameters)
      .filter((p) => p.required)
      .map((p) => p.key);
    return `Agent(${this.group}/${this.slug}, required=[${req.join(", ")}])`;
  }
}

/** Job status returned by run() and jobs.get(). */
export class Job {
  jobId: string;
  agent: string;
  status: string;
  rowCount: number;
  creditsUsed: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  expiresAt: string | null;

  constructor(fields: {
    jobId: string;
    agent: string;
    status: string;
    rowCount?: number;
    creditsUsed?: number;
    error?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    createdAt?: string | null;
    expiresAt?: string | null;
  }) {
    this.jobId = fields.jobId;
    this.agent = fields.agent;
    this.status = fields.status;
    this.rowCount = fields.rowCount ?? 0;
    this.creditsUsed = fields.creditsUsed ?? 0;
    this.error = fields.error ?? null;
    this.startedAt = fields.startedAt ?? null;
    this.completedAt = fields.completedAt ?? null;
    this.createdAt = fields.createdAt ?? null;
    this.expiresAt = fields.expiresAt ?? null;
  }

  /** Alias for jobId. */
  get id(): string {
    return this.jobId;
  }

  get isRunning(): boolean {
    return this.status === "queued" || this.status === "running";
  }

  get isDone(): boolean {
    return (
      this.status === "completed" ||
      this.status === "failed" ||
      this.status === "cancelled"
    );
  }

  get isFailed(): boolean {
    return this.status === "failed" || this.status === "cancelled";
  }

  static fromResponse(data: Record<string, any>): Job {
    return new Job({
      jobId: data.job_id ?? data.id ?? "",
      agent: data.agent ?? "",
      status: data.status ?? "unknown",
      rowCount: data.row_count ?? 0,
      creditsUsed: data.credits_used ?? 0,
      error: data.error ?? null,
      startedAt: data.started_at ?? null,
      completedAt: data.completed_at ?? null,
      createdAt: data.created_at ?? null,
      expiresAt: data.expires_at ?? null,
    });
  }

  toString(): string {
    return `Job(${this.jobId.slice(0, 12)}... ${this.agent} [${this.status}] rows=${this.rowCount})`;
  }
}

/** Results from a completed job. */
export class JobResults {
  status: string;
  rowCount: number;
  data: Array<Record<string, any>>;

  constructor(fields: {
    status: string;
    rowCount: number;
    data: Array<Record<string, any>>;
  }) {
    this.status = fields.status;
    this.rowCount = fields.rowCount;
    this.data = fields.data;
  }

  /** Column names from the first row. */
  get columns(): string[] {
    if (this.data.length > 0) {
      return Object.keys(this.data[0]);
    }
    return [];
  }

  /** Extract a single column as a flat list. */
  toList(column: string): any[] {
    return this.data.map((row) => row[column] ?? null);
  }

  /** Return data as list of dicts (same as .data). */
  toDicts(): Array<Record<string, any>> {
    return this.data;
  }

  /** Make iterable over rows. */
  [Symbol.iterator](): Iterator<Record<string, any>> {
    let index = 0;
    const data = this.data;
    return {
      next(): IteratorResult<Record<string, any>> {
        if (index < data.length) {
          return { value: data[index++], done: false };
        }
        return { value: undefined as any, done: true };
      },
    };
  }

  get length(): number {
    return this.rowCount;
  }

  static fromResponse(data: Record<string, any>): JobResults {
    return new JobResults({
      status: data.status ?? "",
      rowCount: data.row_count ?? 0,
      data: data.data ?? [],
    });
  }

  toString(): string {
    const cols = this.columns.slice(0, 5);
    const ellipsis = this.columns.length > 5 ? "..." : "";
    return `JobResults(${this.rowCount} rows, columns=[${cols.join(", ")}]${ellipsis})`;
  }
}
