/** Base exception for all Mindcase SDK errors. */
export class MindcaseError extends Error {
  statusCode?: number;
  response?: Record<string, any>;

  constructor(
    message: string,
    statusCode?: number,
    response?: Record<string, any>
  ) {
    super(message);
    this.name = "MindcaseError";
    this.statusCode = statusCode;
    this.response = response ?? {};
  }
}

/** Invalid or missing API key (401). */
export class AuthenticationError extends MindcaseError {
  constructor(
    message: string,
    statusCode?: number,
    response?: Record<string, any>
  ) {
    super(message, statusCode, response);
    this.name = "AuthenticationError";
  }
}

/** Not enough credits to run the agent (402). */
export class InsufficientCreditsError extends MindcaseError {
  constructor(
    message: string,
    statusCode?: number,
    response?: Record<string, any>
  ) {
    super(message, statusCode, response);
    this.name = "InsufficientCreditsError";
  }
}

/** Agent, job, or resource not found (404). */
export class NotFoundError extends MindcaseError {
  constructor(
    message: string,
    statusCode?: number,
    response?: Record<string, any>
  ) {
    super(message, statusCode, response);
    this.name = "NotFoundError";
  }
}

/** Invalid parameters (422). */
export class ValidationError extends MindcaseError {
  constructor(
    message: string,
    statusCode?: number,
    response?: Record<string, any>
  ) {
    super(message, statusCode, response);
    this.name = "ValidationError";
  }
}

/** Rate limit exceeded (429). Retry after 60 seconds. */
export class RateLimitError extends MindcaseError {
  constructor(
    message: string,
    statusCode?: number,
    response?: Record<string, any>
  ) {
    super(message, statusCode, response);
    this.name = "RateLimitError";
  }
}
