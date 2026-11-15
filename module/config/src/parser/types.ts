import type { UnknownRecord } from '@travetto/runtime';

/**
 * @concrete
 */
export interface ConfigParser {
  ext: string[];
  parse(input: string): Promise<UnknownRecord> | UnknownRecord;
}
