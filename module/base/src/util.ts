import crypto from 'crypto';

export type TemplatePrim = string | number | boolean | Date | RegExp;

export type TemplateType<T extends Record<string, unknown>> = (values: TemplateStringsArray, ...keys: (Partial<Record<keyof T, TemplatePrim>> | string)[]) => string;

type PromiseResolver<T> = { resolve: (v: T) => void, reject: (err?: unknown) => void };

/**
 * Grab bag of common utilities
 */
export class Util {

  static #match<T, K extends unknown[]>(
    rules: { value: T, positive: boolean }[],
    compare: (rule: T, ...compareInput: K) => boolean,
    unmatchedValue: boolean,
    ...input: K
  ): boolean {
    for (const rule of rules) {
      if (compare(rule.value, ...input)) {
        return rule.positive;
      }
    }
    return unmatchedValue;
  }

  static #allowDenyRuleInput<T>(
    rule: (string | T | [value: T, positive: boolean] | [value: T]),
    convert: (inputRule: string) => T
  ): { value: T, positive: boolean } {
    return typeof rule === 'string' ?
      { value: convert(rule.replace(/^!/, '')), positive: !rule.startsWith('!') } :
      Array.isArray(rule) ?
        { value: rule[0], positive: rule[1] ?? true } :
        { value: rule, positive: true };
  }

  /**
   * Simple check against allow/deny rules
   * @param rules
   */
  static allowDenyMatcher<T, K extends unknown[]>(
    rules: string | (string | T | [value: T, positive: boolean])[],
    convert: (rule: string) => T,
    compare: (rule: T, ...compareInput: K) => boolean,
    cacheKey?: (...keyInput: K) => string
  ): (...input: K) => boolean {

    const rawRules = (Array.isArray(rules) ? rules : rules.split(/\s*,\s*/g));
    const convertedRules = rawRules.map(rule => this.#allowDenyRuleInput(rule, convert));
    const unmatchedValue = !convertedRules.some(r => r.positive);

    if (convertedRules.length) {
      if (cacheKey) {
        const cache: Record<string, boolean> = {};
        return (...input: K) =>
          cache[cacheKey(...input)] ??= this.#match(convertedRules, compare, unmatchedValue, ...input);
      } else {
        return (...input: K) => this.#match(convertedRules, compare, unmatchedValue, ...input);
      }
    } else {
      return () => true;
    }
  }

  /**
   * Produces a satisfied ordering for a list of orderable elements
   */
  static ordered<T,
    U extends { after?: T[] | readonly T[], before?: T[] | readonly T[], key: T },
    V extends { after: Set<T>, key: T, target: U }
  >(items: U[] | readonly U[]): U[] {

    // Turn items into a map by .key value, pointing to a mapping of type V
    const allMap = new Map<T, V>(items.map((x: U): [T, V] => [
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      x.key, { key: x.key, target: x, after: new Set(x.after || []) } as V
    ]));

    const all = new Set<V>(allMap.values());

    // Loop through all new items of type V, converting before into after
    for (const item of all) {
      const before = item.target.before || [];
      for (const bf of before) {
        if (allMap.has(bf)) {
          allMap.get(bf)!.after.add(item.key);
        }
      }
      item.after = new Set(Array.from(item.after).filter(x => allMap.has(x)));
    }

    // Loop through all items again
    const out: U[] = [];
    while (all.size > 0) {

      // Find node with no dependencies
      const next = [...all].find(x => x.after.size === 0);
      if (!next) {
        throw new Error(`Unsatisfiable dependency: ${[...all].map(x => x.target)}`);
      }

      // Store, and remove
      out.push(next.target);
      all.delete(next);

      // Remove node from all other elements in `all`
      for (const rem of all) {
        rem.after.delete(next.key);
      }
    }

    return out;
  }

  /**
   * Creates a template function with ability to wrap values
   * @example
   * ```
   * const tpl = Util.makeTemplate((key: 'title'|'subtitle', val:string) => `||${val}||`)
   * tpl`${{title: 'Main Title'}} is ${{subtitle: 'Sub Title'}}`
   * ```
   */
  static makeTemplate<T extends Record<string, unknown>>(wrap: (key: keyof T, val: TemplatePrim) => string): TemplateType<T> {
    return (values: TemplateStringsArray, ...keys: (Partial<Record<keyof T, TemplatePrim>> | string)[]) => {
      if (keys.length === 0) {
        return values[0];
      } else {
        const out = keys.map((el, i) => {
          let final = el;
          if (typeof el !== 'string') {
            const subKeys = Object.keys(el);
            if (subKeys.length !== 1) {
              throw new Error('Invalid template variable, one and only one key should be specified');
            }
            const [k] = subKeys;
            final = wrap(k, el[k]!)!;
          }
          return `${values[i] ?? ''}${final ?? ''}`;
        });
        if (values.length > keys.length) {
          out.push(values[values.length - 1]);
        }
        return out.join('');
      }
    };
  }

  /**
   * Generate a random UUID
   * @param len The length of the uuid to generate
   */
  static uuid(len: number = 32): string {
    const bytes = crypto.randomBytes(Math.ceil(len / 2));
    // eslint-disable-next-line no-bitwise
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // eslint-disable-next-line no-bitwise
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return bytes.toString('hex').substring(0, len);
  }

  /**
   * Naive hashing
   */
  static naiveHash(text: string): number {
    let hash = 5381;

    for (let i = 0; i < text.length; i++) {
      // eslint-disable-next-line no-bitwise
      hash = (hash * 33) ^ text.charCodeAt(i);
    }

    return Math.abs(hash);
  }

  /**
   * Produce a promise that is externally resolvable
   */
  static resolvablePromise<T = void>(): Promise<T> & PromiseResolver<T> {
    let ops: PromiseResolver<T>;
    const prom = new Promise<T>((resolve, reject) => ops = { resolve, reject });
    return Object.assign(prom, ops!);
  }
}