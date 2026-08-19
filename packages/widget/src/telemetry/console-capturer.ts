import { redactPii } from './pii-redactor.js';

export interface ConsoleEntry {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  timestamp: string;
  args: string[];
}

export class ConsoleCapturer {
  private static buffer: ConsoleEntry[] = [];
  private static maxEntries = 100;
  private static isInstalled = false;

  private static originalMethods: Record<string, Function> = {};

  static install(maxEntries: number = 100) {
    if (this.isInstalled || typeof window === 'undefined') return;
    this.maxEntries = maxEntries;

    const levels: ('log' | 'warn' | 'error' | 'info' | 'debug')[] = [
      'log',
      'warn',
      'error',
      'info',
      'debug',
    ];

    levels.forEach((level) => {
      this.originalMethods[level] = console[level];

      console[level] = (...args: unknown[]) => {
        // Execute original console function first
        this.originalMethods[level]?.apply(console, args);

        try {
          const serializedArgs = args.map((arg) => {
            if (typeof arg === 'string') return redactPii(arg);
            if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack ?? ''}`;
            try {
              return redactPii(JSON.stringify(arg));
            } catch {
              return String(arg);
            }
          });

          this.buffer.push({
            level,
            timestamp: new Date().toISOString(),
            args: serializedArgs,
          });

          if (this.buffer.length > this.maxEntries) {
            this.buffer.shift();
          }
        } catch {
          // Swallow any internal capture failure to never disturb host app
        }
      };
    });

    this.isInstalled = true;
  }

  static getEntries(): ConsoleEntry[] {
    return [...this.buffer];
  }

  static clear() {
    this.buffer = [];
  }
}
