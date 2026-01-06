import type { ConfigData } from '../parser/types.ts';

type OrProm<T> = T | Promise<T>;
type OneOf<T> = T[] | T | undefined;

export type ConfigPayload = { data: ConfigData, priority: number, source: string, detail?: string };

/**
 * @concrete
 */
export interface ConfigSource {
  get(): OrProm<OneOf<ConfigPayload>>;
}