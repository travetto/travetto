import { ConfigData } from '../parser/types';

export type ConfigValue = { config: ConfigData, source: string, profile: string, priority: number };

/**
 * @concrete ../internal/types:ConfigSourceTarget
 */
export interface ConfigSource {
  priority: number;
  getValues(profiles: string[]): Promise<ConfigValue[]> | ConfigValue[];
}
