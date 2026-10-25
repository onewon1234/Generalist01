/** Network access for collection. Injected as a function so tests never hit the network. */

export interface FetchResult {
  ok: boolean;
  status: number;
  finalUrl: string;
  contentType: string;
  body: string;
  error?: string;
  ms: number;
}

export type Fetcher = (url: string, init?: { headers?: Record<string, string>; timeoutMs?: number }) => Promise<FetchResult>;

export const USER_AGENT = 'GeneralistDailyBot/0.1 (+https://github.com/onewon1234/Generalist01)';
const MAX_BYTES = 5_000_000;

export const httpFetch: Fetcher = async (url, init = {}) => {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, text/html;q=0.8, */*;q=0.5', ...init.headers },
      redirect: 'follow',
      signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
    });
    const buf = new Uint8Array(await res.arrayBuffer());
    const body = new TextDecoder('utf-8').decode(buf.slice(0, MAX_BYTES));
    return { ok: res.ok, status: res.status, finalUrl: res.url || url, contentType: res.headers.get('content-type') ?? '', body, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, status: 0, finalUrl: url, contentType: '', body: '', error: (e as Error).message, ms: Date.now() - t0 };
  }
};
