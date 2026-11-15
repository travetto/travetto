import type { UnknownRecord } from '@travetto/runtime';

type OrProm<T> = T | Promise<T>;
type OneOf<T> = T[] | T | undefined;

export type ConfigPayload = { data: UnknownRecord; priority: number; source: string; detail?: string };

/**
 * @concrete
 */
export interface ConfigSource {
  get(): OrProm<OneOf<ConfigPayload>>;
}
