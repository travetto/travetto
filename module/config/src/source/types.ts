import { ConfigData } from '../parser/types.ts';

type OrProm<T> = T | Promise<T>;
type OneOf<T> = T[] | T | undefined;

export type ConfigSpec = { data: ConfigData, priority: number, source: string, detail?: string };

/**
 * @concrete ../internal/types#ConfigSourceTarget
 */
export interface ConfigSource {
  get(): OrProm<OneOf<ConfigSpec>>;
}