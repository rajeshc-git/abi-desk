import { redactPii } from './pii-redactor.js';

export interface NetworkEntry {
  method: string;
  url: string;
  status: number;
  durationMs: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  error?: string;
  timestamp: string;
}

export class NetworkCapturer {
  private static buffer: NetworkEntry[] = [];
  private static maxEntries = 50;
  private static isInstalled = false;

  static install(maxEntries: number = 50) {
    if (this.isInstalled || typeof window === 'undefined') return;
    this.maxEntries = maxEntries;

    this.interceptFetch();
    this.interceptXhr();
    this.isInstalled = true;
  }

  private static interceptFetch() {
    const originalFetch = window.fetch;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      const startTime = performance.now();
      const timestamp = new Date().toISOString();

      try {
        const response = await originalFetch(input, init);
        const durationMs = Math.round(performance.now() - startTime);

        // Do not intercept widget internal requests to avoid recursion
        if (!url.includes('/api/v1/media/') && !url.includes('/api/v1/tickets')) {
          NetworkCapturer.record({
            method: method.toUpperCase(),
            url: redactPii(url),
            status: response.status,
            durationMs,
            timestamp,
          });
        }

        return response;
      } catch (err) {
        const durationMs = Math.round(performance.now() - startTime);
        const errorMsg = err instanceof Error ? err.message : String(err);

        NetworkCapturer.record({
          method: method.toUpperCase(),
          url: redactPii(url),
          status: 0,
          durationMs,
          error: errorMsg,
          timestamp,
        });

        throw err;
      }
    };
  }

  private static interceptXhr() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      ...rest: [boolean?, string?, string?]
    ) {
      (this as any)._abidesk_method = method;
      (this as any)._abidesk_url = typeof url === 'string' ? url : url.toString();
      (this as any)._abidesk_startTime = performance.now();
      return originalOpen.apply(this, [method, url, ...rest] as any);
    };

    XMLHttpRequest.prototype.send = function (...args: any[]) {
      this.addEventListener('loadend', () => {
        try {
          const method = ((this as any)._abidesk_method ?? 'GET').toUpperCase();
          const url = (this as any)._abidesk_url ?? '';
          const startTime = (this as any)._abidesk_startTime ?? performance.now();
          const durationMs = Math.round(performance.now() - startTime);

          if (!url.includes('/api/v1/media/') && !url.includes('/api/v1/tickets')) {
            NetworkCapturer.record({
              method,
              url: redactPii(url),
              status: this.status,
              durationMs,
              timestamp: new Date().toISOString(),
            });
          }
        } catch {
          // Ignore
        }
      });

      return originalSend.apply(
        this,
        args as [Document | XMLHttpRequestBodyInit | null | undefined],
      );
    };
  }

  private static record(entry: NetworkEntry) {
    this.buffer.push(entry);
    if (this.buffer.length > this.maxEntries) {
      this.buffer.shift();
    }
  }

  static getEntries(): NetworkEntry[] {
    return [...this.buffer];
  }

  static clear() {
    this.buffer = [];
  }
}
