import { ConfigData } from '../parser/types';
import { ConfigSource, ConfigSpec } from './types';

/**
 * Meant to be instantiated and provided as a unique config source
 */
export class MemoryConfigSource implements ConfigSource {
  #spec: ConfigSpec;

  constructor(key: string, data: ConfigData, priority: number = 500) {
    this.#spec = { data, priority, source: `memory://${key}` };
  }

  get(): ConfigSpec {
    return this.#spec;
  }
}