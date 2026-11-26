import { expect, test } from "bun:test";
import { createHttpClient, HttpError } from "../../src/services/http";

test("replays the cached body on 304 and sends If-None-Match", async () => {
  const seen: (string | null)[] = [];
  let calls = 0;
  const fakeFetch = (async (_url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    seen.push(headers.get("If-None-Match"));
    calls++;
    if (calls === 1)
      return new Response(JSON.stringify({ n: 1 }), {
        headers: { etag: '"v1"', "x-ratelimit-remaining": "59", "x-ratelimit-reset": "1700000000" },
      });
    return new Response(null, { status: 304 });
  }) as unknown as typeof fetch;

  const http = createHttpClient({ baseUrl: "https://api.example.com", headers: {}, fetch: fakeFetch });
  expect(await http.get<{ n: number }>("/x")).toEqual({ n: 1 });
  expect(await http.get<{ n: number }>("/x")).toEqual({ n: 1 });
  expect(seen).toEqual([null, '"v1"']);
  expect(http.rateLimit).toEqual({ remaining: 59, resetAt: 1_700_000_000_000 });
});

test("throws HttpError on failure", async () => {
  const fakeFetch = (async () =>
    new Response("nope", { status: 401, statusText: "Unauthorized" })) as unknown as typeof fetch;
  const http = createHttpClient({ baseUrl: "https://api.example.com", headers: {}, fetch: fakeFetch });
  await expect(http.get("/x")).rejects.toBeInstanceOf(HttpError);
});
