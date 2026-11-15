import type { UnknownRecord } from '@travetto/runtime';

export type ConfigData = UnknownRecord;

/**
 * @concrete
 */
export interface ConfigParser {
  ext: string[];
  parse(input: string): Promise<ConfigData> | ConfigData;
}
