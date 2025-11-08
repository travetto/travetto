import { castKey, castTo, Class, ClassInstance, TypedObject } from '@travetto/runtime';

import { InputConfig, SchemaConfig } from '../service/types.ts';
import { ValidationError, ValidationKindCore, ValidationResult } from './types.ts';
import { Messages } from './messages.ts';
import { isValidationError, TypeMismatchError, ValidationResultError } from './error.ts';
import { DataUtil } from '../data.ts';
import { CommonRegExpToName } from './regexp.ts';
import { SchemaRegistryIndex } from '../service/registry-index.ts';

/**
 * Get the schema config for Class/Schema config, including support for polymorphism
 * @param base The starting type or config
 * @param o The value to use for the polymorphic check
 */
function resolveSchema<T>(base: Class<T>, o: T): SchemaConfig {
  const target = SchemaRegistryIndex.resolveInstanceType(base, o);
  return SchemaRegistryIndex.getSchemaConfig(target);
}

function isClassInstance<T>(o: unknown): o is ClassInstance<T> {
  return !DataUtil.isPlainObject(o) && o !== null && typeof o === 'object' && !!o.constructor;
}

function isRangeValue(o: unknown): o is number | string | Date {
  return typeof o === 'string' || typeof o === 'number' || o instanceof Date;
}

/**
 * The schema validator applies the schema constraints to a given object and looks
 * for errors
 */
export class SchemaValidator {

  /**
   * Validate the schema for a given object
   * @param schema The config to validate against
   * @param o The object to validate
   * @param relative The relative path as the validation recurses
   */
  static #validateSchema<T>(schema: SchemaConfig, o: T, relative: string): ValidationError[] {
    let errors: ValidationError[] = [];

    const fields = TypedObject.keys<SchemaConfig>(schema);
    for (const field of fields) {
      if (schema[field].access !== 'readonly') { // Do not validate readonly fields
        errors = errors.concat(this.#validateFieldSchema(schema[field], o[castKey<T>(field)], relative));
      }
    }

    return errors;
  }

  /**
   * Validate a single input config against a passed in value
   * @param input The input schema configuration
   * @param val The raw value, could be an array or not
   * @param relative The relative path of object traversal
   */
  static #validateFieldSchema(input: InputConfig, val: unknown, relative: string = ''): ValidationError[] {
    const key = 'name' in input ? input.name : ('index' in input ? input.index : 'unknown');
    const path = `${relative}${relative ? '.' : ''}${key}`;
    const hasValue = !(val === undefined || val === null || (typeof val === 'string' && val === '') || (Array.isArray(val) && val.length === 0));

    if (!hasValue) {
      if (input.required && input.required.active) {
        return this.#prepareErrors(path, [{ kind: 'required', ...input.required }]);
      } else {
        return [];
      }
    }

    const { type, array } = input;
    const complex = SchemaRegistryIndex.has(type);

    if (type === Object) {
      return [];
    } else if (array) {
      if (!Array.isArray(val)) {
        return this.#prepareErrors(path, [{ kind: 'type', type: Array, value: val }]);
      }
      let errors: ValidationError[] = [];
      if (complex) {
        for (let i = 0; i < val.length; i++) {
          const subErrors = this.#validateSchema(resolveSchema(type, val[i]), val[i], `${path}[${i}]`);
          errors = errors.concat(subErrors);
        }
      } else {
        for (let i = 0; i < val.length; i++) {
          const subErrors = this.#validateInput(input, val[i]);
          errors.push(...this.#prepareErrors(`${path}[${i}]`, subErrors));
        }
      }
      return errors;
    } else if (complex) {
      return this.#validateSchema(resolveSchema(type, val), val, path);
    } else {
      const fieldErrors = this.#validateInput(input, val);
      return this.#prepareErrors(path, fieldErrors);
    }
  }

  /**
   * Validate the range for a number, date
   * @param input The config to validate against
   * @param key The bounds to check
   * @param value The value to validate
   */
  static #validateRange(input: InputConfig, key: 'min' | 'max', value: string | number | Date): boolean {
    const f = input[key]!;
    const valueNum = (typeof value === 'string') ?
      (input.type === Date ? Date.parse(value) : parseInt(value, 10)) :
      (value instanceof Date ? value.getTime() : value);

    const boundary = (typeof f.n === 'number' ? f.n : f.n.getTime());
    return key === 'min' ? valueNum < boundary : valueNum > boundary;
  }

  /**
   * Validate a given field by checking all the appropriate constraints
   *
   * @param input The config of the field to validate
   * @param value The actual value
   */
  static #validateInput(input: InputConfig, value: unknown): ValidationResult[] {
    const criteria: ([string, InputConfig[ValidationKindCore]] | [string])[] = [];

    if (
      (input.type === String && (typeof value !== 'string')) ||
      (input.type === Number && ((typeof value !== 'number') || Number.isNaN(value))) ||
      (input.type === Date && (!(value instanceof Date) || Number.isNaN(value.getTime()))) ||
      (input.type === Boolean && typeof value !== 'boolean')
    ) {
      criteria.push(['type']);
      return [{ kind: 'type', type: input.type.name.toLowerCase() }];
    }

    if (input.type?.validateSchema) {
      const kind = input.type.validateSchema(value);
      switch (kind) {
        case undefined: break;
        case 'type': return [{ kind, type: input.type.name }];
        default:
          criteria.push([kind]);
      }
    }

    if (input.match && !input.match.re.test(`${value}`)) {
      criteria.push(['match', input.match]);
    }

    if (input.minlength && `${value}`.length < input.minlength.n) {
      criteria.push(['minlength', input.minlength]);
    }

    if (input.maxlength && `${value}`.length > input.maxlength.n) {
      criteria.push(['maxlength', input.maxlength]);
    }

    if (input.enum && !input.enum.values.includes(castTo(value))) {
      criteria.push(['enum', input.enum]);
    }

    if (input.min && (!isRangeValue(value) || this.#validateRange(input, 'min', value))) {
      criteria.push(['min', input.min]);
    }

    if (input.max && (!isRangeValue(value) || this.#validateRange(input, 'max', value))) {
      criteria.push(['max', input.max]);
    }

    const errors: ValidationResult[] = [];
    for (const [key, block] of criteria) {
      errors.push({ ...block, kind: key, value });
    }

    return errors;
  }

  /**
   * Convert validation results into proper errors
   * @param path The object path
   * @param results The list of results for that specific path
   */
  static #prepareErrors(path: string, results: ValidationResult[]): ValidationError[] {
    const out: ValidationError[] = [];
    for (const result of results) {
      const err: ValidationError = {
        ...result,
        kind: result.kind,
        value: result.value,
        message: '',
        re: CommonRegExpToName.get(result.re!) ?? result.re?.source ?? '',
        path,
        type: (typeof result.type === 'function' ? result.type.name : result.type)
      };

      if (!err.re) {
        delete err.re;
      }

      const msg = result.message ?? (
        Messages.get(err.re ?? '') ??
        Messages.get(err.kind) ??
        Messages.get('default')!
      );

      err.message = msg
        .replace(/\{([^}]+)\}/g, (_, k: (keyof ValidationError)) => `${err[k]}`);

      out.push(err);
    }
    return out;
  }

  /**
   * Validate the class level validations
   */
  static async #validateClassLevel<T>(cls: Class<T>, o: T, view?: string): Promise<ValidationError[]> {
    if (!SchemaRegistryIndex.has(cls)) {
      return [];
    }

    const schema = SchemaRegistryIndex.getConfig(cls);

    const errors: ValidationError[] = [];
    // Handle class level validators
    for (const fn of schema.validators) {
      try {
        const res = await fn(o, view);
        if (res) {
          if (Array.isArray(res)) {
            errors.push(...res);
          } else {
            errors.push(res);
          }
        }
      } catch (err: unknown) {
        if (isValidationError(err)) {
          errors.push(err);
        } else {
          throw err;
        }
      }
    }
    return errors;
  }

  /**
   * Validate an object against it's constructor's schema
   * @param cls The class to validate the objects against
   * @param o The object to validate
   * @param view The optional view to limit the scope to
   */
  static async validate<T>(cls: Class<T>, o: T, view?: string): Promise<T> {
    if (isClassInstance(o) && !(o instanceof cls || cls.Ⲑid === o.constructor.Ⲑid)) {
      throw new TypeMismatchError(cls.name, o.constructor.name);
    }
    cls = SchemaRegistryIndex.resolveInstanceType(cls, o);

    const config = SchemaRegistryIndex.getSchemaConfig(cls, view);

    // Validate using standard behaviors
    const errors = [
      ...this.#validateSchema(config, o, ''),
      ... await this.#validateClassLevel(cls, o, view)
    ];
    if (errors.length) {
      throw new ValidationResultError(errors);
    }

    return o;
  }

  /**
   * Validate an entire array of values
   * @param cls The class to validate the objects against
   * @param obj The values to validate
   * @param view The view to limit by
   */
  static async validateAll<T>(cls: Class<T>, obj: T[], view?: string): Promise<T[]> {
    return await Promise.all<T>((obj ?? [])
      .map(o => this.validate(cls, o, view)));
  }

  /**
   * Validate partial, ignoring required fields as they are partial
   *
   * @param cls The class to validate against
   * @param o The value to validate
   * @param view The view to limit by
   */
  static async validatePartial<T>(cls: Class<T>, o: T, view?: string): Promise<T> {
    try {
      await this.validate(cls, o, view);
    } catch (err) {
      if (err instanceof ValidationResultError) { // Don't check required fields
        const errs = err.details.errors.filter(x => x.kind !== 'required');
        if (errs.length) {
          err.details.errors = errs;
          throw err;
        }
      }
    }
    return o;
  }

  /**
   * Validate method invocation
   *
   * @param cls The class to validate against
   * @param method The method being invoked
   * @param params The params to validate
   */
  static async validateMethod<T>(cls: Class<T>, method: string | symbol, params: unknown[], prefixes: (string | symbol | undefined)[] = []): Promise<void> {
    const errors: ValidationError[] = [];
    const config = SchemaRegistryIndex.getMethodConfig(cls, method);

    for (const param of config.parameters) {
      const i = param.index;
      errors.push(...[
        ... this.#validateFieldSchema(param, params[i]),
        ... await this.#validateClassLevel(param.type, params[i])
      ].map(x => {
        if (param.name && typeof param.name === 'string') {
          x.path = !prefixes[i] ?
            x.path.replace(`${param.name}.`, '') :
            x.path.replace(param.name, prefixes[i]!.toString());
        }
        return x;
      }));
    }
    for (const validator of config.validators) {
      const res = await validator(...params);
      if (res) {
        if (Array.isArray(res)) {
          errors.push(...res);
        } else {
          errors.push(res);
        }
      }
    }
    if (errors.length) {
      throw new ValidationResultError(errors);
    }
  }
}