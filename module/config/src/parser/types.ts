export type ConfigData = Record<string, unknown>;

/**
 * @concrete
 */
export interface ConfigParser {
  ext: string[];
  parse(input: string): Promise<ConfigData> | ConfigData;
}
