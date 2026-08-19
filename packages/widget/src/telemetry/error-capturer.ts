import { redactPii } from './pii-redactor.js';

export interface UncaughtErrorEntry {
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  timestamp: string;
}

export class ErrorCapturer {
  private static buffer: UncaughtErrorEntry[] = [];
  private static maxEntries = 20;
  private static isInstalled = false;

  static install(maxEntries: number = 20) {
    if (this.isInstalled || typeof window === 'undefined') return;
    this.maxEntries = maxEntries;

    window.addEventListener('error', (event) => {
      try {
        const entry: UncaughtErrorEntry = {
          message: redactPii(event.message || 'Uncaught Error'),
          source: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack ? redactPii(event.error.stack) : undefined,
          timestamp: new Date().toISOString(),
        };

        ErrorCapturer.record(entry);
      } catch {
        // Ignore
      }
    });

    window.addEventListener('unhandledrejection', (event) => {
      try {
        const reason = event.reason;
        const message = reason instanceof Error ? reason.message : String(reason);
        const stack = reason instanceof Error ? reason.stack : undefined;

        const entry: UncaughtErrorEntry = {
          message: redactPii(`Unhandled Promise Rejection: ${message}`),
          stack: stack ? redactPii(stack) : undefined,
          timestamp: new Date().toISOString(),
        };

        ErrorCapturer.record(entry);
      } catch {
        // Ignore
      }
    });

    this.isInstalled = true;
  }

  private static record(entry: UncaughtErrorEntry) {
    this.buffer.push(entry);
    if (this.buffer.length > this.maxEntries) {
      this.buffer.shift();
    }
  }

  static getEntries(): UncaughtErrorEntry[] {
    return [...this.buffer];
  }

  static clear() {
    this.buffer = [];
  }
}
