import { ConfigData } from '../parser/types';

/**
 * @concrete ../internal/types:ConfigSourceTarget
 */
export interface ConfigSource {
  priority: number;
  source: string;
  getData(): Promise<ConfigData[] | ConfigData | undefined> | ConfigData[] | ConfigData | undefined;
}