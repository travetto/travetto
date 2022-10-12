const REGEX_PAT = /[\/](.*)[\/](i|g|m|s)?/;

export class CoerceUtil {
  /**
   * Is a value a plain JS object, created using {}
   */
  static #isPlainObject(obj: unknown): obj is Record<string, unknown> {
    return typeof obj === 'object' // separate from primitives
      && obj !== undefined
      && obj !== null         // is obvious
      && obj.constructor === Object // separate instances (Array, DOM, ...)
      && Object.prototype.toString.call(obj) === '[object Object]'; // separate build-in like Math
  }

  /**
   * Create regex from string, including flags
   */
  static #toRegex(input: string | RegExp): RegExp {
    if (input instanceof RegExp) {
      return input;
    } else if (REGEX_PAT.test(input)) {
      const [, pat, mod] = input.match(REGEX_PAT) ?? [];
      return new RegExp(pat, mod);
    } else {
      return new RegExp(input);
    }
  }

  /**
   * Coerce an input of any type to the class provided
   * @param input Input value
   * @param type Class to coerce to (String, Boolean, Number, Date, RegEx, Object)
   * @param strict Should a failure to coerce throw an error?
   */
  static coerce(input: unknown, type: typeof String, strict?: boolean): string;
  static coerce(input: unknown, type: typeof Number, strict?: boolean): number;
  static coerce(input: unknown, type: typeof Boolean, strict?: boolean): boolean;
  static coerce(input: unknown, type: typeof Date, strict?: boolean): Date;
  static coerce(input: unknown, type: typeof RegExp, strict?: boolean): RegExp;
  static coerce(input: unknown, type: Function, strict = true): unknown {
    // Do nothing
    if (input === null || input === undefined) {
      return input;
    } else if (!strict && type !== String && input === '') {
      return undefined; // treat empty string as undefined for non-strings in non-strict mode
    } else if (type && input instanceof type) {
      return input;
    }

    switch (type) {
      case Date: {
        const res = typeof input === 'number' || /^[-]?\d+$/.test(`${input}`) ?
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          new Date(parseInt(input as string, 10)) : new Date(input as Date);
        if (strict && Number.isNaN(res.getTime())) {
          throw new Error(`Invalid date value: ${input}`);
        }
        return res;
      }
      case Number: {
        const res = `${input}`.includes('.') ? parseFloat(`${input}`) : parseInt(`${input}`, 10);
        if (strict && Number.isNaN(res)) {
          throw new Error(`Invalid numeric value: ${input}`);
        }
        return res;
      }
      case Boolean: {
        const res = /^(true|yes|1|on)$/i.test(`${input}`);
        if (strict && !/^(false|no|off|0|true|yes|on|1)$/i.test(`${input}`)) {
          throw new Error(`Invalid boolean value: ${input}`);
        }
        return res;
      }
      case RegExp: {
        if (typeof input === 'string') {
          try {
            return this.#toRegex(input);
          } catch {
            if (strict) {
              throw new Error(`Invalid regex: ${input}`);
            } else {
              return;
            }
          }
        } else if (strict) {
          throw new Error('Invalid regex type');
        } else {
          return;
        }
      }
      case Object: {
        if (!strict || this.#isPlainObject(input)) {
          return input;
        } else {
          throw new Error('Invalid object type');
        }
      }
      case undefined:
      case String: return `${input}`;
    }
    throw new Error(`Unknown type ${type.name}`);
  }
}