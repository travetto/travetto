import { describeFunction } from '@travetto/runtime';
import { ClassConfig } from './service/types';

const SYNTHETIC_EXT = 'Ⲑsyn';
const SYNTHETIC_RE = new RegExp(`(__)(\\d+)${SYNTHETIC_EXT}$`);

/**
 * Name resolver, specifically for synthetic types
 */
export class SchemaNameResolver {

  #schemaIdToName = new Map<string, string>();
  #digits: number;
  #base: number;

  constructor(digits = 5) {
    this.#digits = digits;
    this.#base = 10 ** this.#digits;
  }

  getName(schema: ClassConfig): string {
    const id = schema.class.Ⲑid;
    if (describeFunction(schema.class)?.synthetic && SYNTHETIC_RE.test(schema.class.name)) {
      if (!this.#schemaIdToName.has(id)) {
        const name = schema.class.name.replace(SYNTHETIC_RE, (_, pref, uid) => `__${(+uid % this.#base).toString().padStart(this.#digits, '0')}`);
        this.#schemaIdToName.set(id, name);
      }
      return this.#schemaIdToName.get(id)!;
    } else {
      return schema.class.name.replace(SYNTHETIC_EXT, '');
    }
  }
}