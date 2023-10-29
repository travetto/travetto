import crypto from 'crypto';
import { RootIndex, path } from '@travetto/manifest';

export type TemplatePrim = string | number | boolean | Date | RegExp;

export type TemplateType<T extends string> = (values: TemplateStringsArray, ...keys: (Partial<Record<T, TemplatePrim>> | string)[]) => string;

type PromiseResolver<T> = { resolve: (v: T) => void, reject: (err?: unknown) => void };
type List<T> = T[] | readonly T[];
type OrderedState<T> = { after?: List<T>, before?: List<T>, key: T };

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

  static #buildEdgeMap<T, U extends OrderedState<T>>(items: List<U>): Map<T, Set<T>> {
    const edgeMap = new Map(items.map(x => [x.key, new Set(x.after ?? [])]));

    // Build out edge map
    for (const input of items) {
      for (const bf of input.before ?? []) {
        if (edgeMap.has(bf)) {
          edgeMap.get(bf)!.add(input.key);
        }
      }
      const afterSet = edgeMap.get(input.key)!;
      for (const el of input.after ?? []) {
        afterSet.add(el);
      }
    }
    return edgeMap;
  }

  /**
   * Produces a satisfied ordering for a list of orderable elements
   */
  static ordered<T, U extends OrderedState<T>>(items: List<U>): U[] {
    const edgeMap = this.#buildEdgeMap<T, U>(items);

    // Loop through all items again
    const keys: T[] = [];
    while (edgeMap.size > 0) {

      // Find node with no dependencies
      const key = [...edgeMap].find(([, after]) => after.size === 0)?.[0];
      if (!key) {
        throw new Error(`Unsatisfiable dependency: ${[...edgeMap.keys()]}`);
      }

      // Store, and remove
      keys.push(key);
      edgeMap.delete(key);

      // Remove node from all other elements in `all`
      for (const [, rem] of edgeMap) {
        rem.delete(key);
      }
    }

    const inputMap = new Map(items.map(x => [x.key, x]));
    return keys.map(k => inputMap.get(k)!);
  }

  /**
   * Creates a template function with ability to wrap values
   * @example
   * ```
   * const tpl = Util.makeTemplate((key: 'title'|'subtitle', val:TemplatePrim) => `||${val}||`)
   * tpl`${{title: 'Main Title'}} is ${{subtitle: 'Sub Title'}}`
   * ```
   */
  static makeTemplate<T extends string>(wrap: (key: T, val: TemplatePrim) => string): TemplateType<T> {
    return (values: TemplateStringsArray, ...keys: (Partial<Record<T, TemplatePrim>> | string)[]) => {
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
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            final = wrap(k as T, el[k as T]!)!;
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
   * Generate a proper sha512 hash from a src value
   * @param src The seed value to build the hash from
   * @param len The optional length of the hash to generate
   */
  static fullHash(src: string, len: number = -1): string {
    const hash = crypto.createHash('sha512');
    hash.update(src);
    const ret = hash.digest('hex');
    return len > 0 ? ret.substring(0, len) : ret;
  }

  /**
   * Generate a short hash from a src value, based on sha512
   * @param src The seed value to build the hash from
   */
  static shortHash(src: string): string {
    return this.fullHash(src, 32);
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

  /**
   * Resolve tool path for usage
   */
  static resolveToolPath(rel: string, moduleSpecific = false): string {
    const parts = [rel];
    if (moduleSpecific) {
      parts.unshift('node_modules', RootIndex.manifest.mainModule);
    }
    return path.resolve(RootIndex.manifest.workspacePath, RootIndex.manifest.toolFolder, ...parts);
  }
}