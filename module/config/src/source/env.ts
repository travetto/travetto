import { Env } from '@travetto/base';

import { ConfigSource } from './types';
import { ConfigData } from '../parser/types';

/**
 * Represents the environment mapped data as a JSON blob
 */
export class EnvConfigSource implements ConfigSource {
  priority: number;
  source: string;
  #envKey: string;

  constructor(key: string, priority: number) {
    this.#envKey = key;
    this.priority = priority;
    this.source = `env://${this.#envKey}`;
  }

  getData(): ConfigData | undefined {
    try {
      const data = JSON.parse(Env.get(this.#envKey, '{}'));
      return data;
    } catch (e) {
      console.error(`env.${this.#envKey} is an invalid format`, { text: Env.get(this.#envKey) });
    }
  }
}