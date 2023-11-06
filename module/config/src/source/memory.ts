import { ConfigData } from '../parser/types';
import { ConfigSource } from './types';

/**
 * Meant to be instantiated and provided as a unique config source
 */
export class MemoryConfigSource implements ConfigSource {
  priority: number;
  data: ConfigData;
  source: string;

  constructor(key: string, data: ConfigData, priority: number = 500) {
    this.data = data;
    this.priority = priority;
    this.source = `memory://${key}`;
  }

  getData(): ConfigData {
    return this.data;
  }
}