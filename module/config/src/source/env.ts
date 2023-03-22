import { Env, GlobalEnv } from '@travetto/base';

import { ConfigSource, ConfigValue } from './types';

/**
 * Represents the environment mapped data as a JSON blob
 */
export class EnvConfigSource implements ConfigSource {
  priority: number;
  name = 'env';
  #envKey: string;

  constructor(key: string, priority: number) {
    this.#envKey = key;
    this.priority = priority;
  }

  getValues(profiles: string[]): ConfigValue[] {
    try {
      const data = JSON.parse(Env.get(this.#envKey, '{}'));
      return [{ profile: GlobalEnv.envName, config: data, source: `${this.name}://${this.#envKey}`, priority: this.priority }];
    } catch (e) {
      console.error(`env.${this.#envKey} is an invalid format`, { text: Env.get(this.#envKey) });
      return [];
    }
  }
}