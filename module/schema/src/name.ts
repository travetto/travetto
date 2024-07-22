import { RuntimeIndex } from '@travetto/manifest';
import { ClassConfig } from './service/types';

const SYN_RE = /(__)(\d+)Ⲑsyn$/;

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
    if (RuntimeIndex.getFunctionMetadataFromClass(schema.class)?.synthetic && SYN_RE.test(schema.class.name)) {
      if (!this.#schemaIdToName.has(id)) {
        const name = schema.class.name.replace(SYN_RE, (_, pref, uid) => `__${(+uid % this.#base).toString().padStart(this.#digits, '0')}`);
        this.#schemaIdToName.set(id, name);
      }
      return this.#schemaIdToName.get(id)!;
    } else {
      return schema.class.name.replace('Ⲑsyn', '');
    }
  }
}