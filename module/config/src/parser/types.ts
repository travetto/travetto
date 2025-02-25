export type ConfigData = Record<string, unknown>;

/**
 * @concrete ../internal/types#ConfigParserTarget
 */
export interface ConfigParser {
  ext: string[];
  parse(input: string): Promise<ConfigData> | ConfigData;
}
