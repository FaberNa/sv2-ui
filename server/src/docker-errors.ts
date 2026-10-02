export class DockerConnectionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DockerConnectionError';
  }
}

export function isMissingContainerError(error: unknown): boolean {
  let current = error;

  for (let depth = 0; depth < 8 && current && typeof current === 'object'; depth += 1) {
    const candidate = current as {
      cause?: unknown;
      message?: string;
      reason?: string;
      statusCode?: number;
      json?: { message?: string };
    };

    const hasMessageStr = typeof candidate.message === 'string' && candidate.message.includes('No such container');
    const hasJsonStr = typeof candidate.json?.message === 'string' && /no such container/i.test(candidate.json.message);

    if (hasMessageStr || hasJsonStr) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}
