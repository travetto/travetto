import type { ConfigData } from '../parser/types.ts';
import type { ConfigSource, ConfigPayload } from './types.ts';

/**
 * Meant to be instantiated and provided as a unique config source
 */
export class MemoryConfigSource implements ConfigSource {
  #payload: ConfigPayload;

  constructor(key: string, data: ConfigData, priority: number = 500) {
    this.#payload = { data, priority, source: `memory://${key}` };
  }

  get(): ConfigPayload {
    return this.#payload;
  }
}