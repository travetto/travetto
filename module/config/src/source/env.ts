import { JSONUtil } from '@travetto/runtime';
import type { ConfigSource, ConfigPayload } from './types.ts';

/**
 * Represents the environment mapped data as a JSON blob
 */
export class EnvConfigSource implements ConfigSource {
  #envKey: string;
  #priority: number;

  constructor(key: string, priority: number) {
    this.#envKey = key;
    this.#priority = priority;
  }

  get(): ConfigPayload | undefined {
    try {
      const data: Record<string, unknown> = JSONUtil.fromUTF8(process.env[this.#envKey] || '{}');
      return { data, priority: this.#priority, source: `env://${this.#envKey}` };
    } catch {
      console.error(`env.${this.#envKey} is an invalid format`, { text: process.env[this.#envKey] });
    }
  }
}