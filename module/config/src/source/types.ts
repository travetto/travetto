import { ConfigData } from '../parser/types';

export type ConfigPriority = 1 | 2 | 3;
export type ConfigValue = { config: ConfigData, source: string, profile: string, priority: ConfigPriority };

/**
 * @concrete ../internal/types:ConfigSourceTarget
 */
export interface ConfigSource {
  priority: ConfigPriority;
  getValues(profiles: string[]): Promise<ConfigValue[]> | ConfigValue[];
}
