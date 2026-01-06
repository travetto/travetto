import type { SchemaClassConfig } from './service/types.ts';

const ID_REGEX = /(\d{1,100})Δ$/;

/**
 * Name resolver, specifically for synthetic types
 */
export class SchemaNameResolver {

  #schemaIdToName = new Map<string, string>();
  #digits: number;

  constructor(digits = 5) {
    this.#digits = digits;
  }

  getName(schema: SchemaClassConfig): string {
    const cls = schema.class;
    const id = cls.Ⲑid;
    if (ID_REGEX.test(cls.name)) {
      if (!this.#schemaIdToName.has(id)) {
        const name = cls.name.replace(ID_REGEX, (_, uniqueId) => uniqueId.slice(-this.#digits));
        this.#schemaIdToName.set(id, name);
      }
      return this.#schemaIdToName.get(id)!;
    } else {
      return cls.name;
    }
  }
}