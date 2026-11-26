import { logger } from "./logger";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface RateLimit {
  remaining: number;
  /** Epoch ms when the quota resets. */
  resetAt: number;
}

export interface HttpClient {
  get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T>;
  readonly rateLimit: RateLimit | undefined;
}

interface Options {
  baseUrl: string;
  headers: Record<string, string>;
  /** Injected for tests. */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Minimal JSON client with conditional requests: every GET remembers its ETag and replays
 * the cached body on `304 Not Modified` (which does not count against GitHub's rate limit).
 */
export function createHttpClient(opts: Options): HttpClient {
  const doFetch = opts.fetch ?? fetch;
  const cache = new Map<string, { etag: string; body: unknown }>();
  let rateLimit: RateLimit | undefined;

  return {
    get rateLimit() {
      return rateLimit;
    },
    async get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
      const url = new URL(
        path.replace(/^\//, ""),
        opts.baseUrl.endsWith("/") ? opts.baseUrl : `${opts.baseUrl}/`,
      );
      for (const [k, v] of Object.entries(query ?? {}))
        if (v !== undefined) url.searchParams.set(k, String(v));
      const key = url.toString();
      const cached = cache.get(key);

      const res = await doFetch(key, {
        headers: {
          Accept: "application/json",
          ...opts.headers,
          ...(cached ? { "If-None-Match": cached.etag } : {}),
        },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
      });

      const remaining = res.headers.get("x-ratelimit-remaining") ?? res.headers.get("ratelimit-remaining");
      const reset = res.headers.get("x-ratelimit-reset") ?? res.headers.get("ratelimit-reset");
      if (remaining && reset) rateLimit = { remaining: Number(remaining), resetAt: Number(reset) * 1000 };

      if (res.status === 304 && cached) return cached.body as T;
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        logger.warn(`HTTP ${res.status} ${key}`, text.slice(0, 300));
        throw new HttpError(res.status, key, `${res.status} ${res.statusText}`.trim());
      }
      const body = (await res.json()) as T;
      const etag = res.headers.get("etag");
      if (etag) cache.set(key, { etag, body });
      return body;
    },
  };
}
