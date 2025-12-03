import { castKey, castTo, Class, ClassInstance, TypedObject } from '@travetto/runtime';

import { SchemaInputConfig, SchemaFieldMap } from '../service/types.ts';
import { ValidationError, ValidationKindCore, ValidationResult } from './types.ts';
import { Messages } from './messages.ts';
import { isValidationError, TypeMismatchError, ValidationResultError } from './error.ts';
import { DataUtil } from '../data.ts';
import { CommonRegExpToName } from './regexp.ts';
import { SchemaRegistryIndex } from '../service/registry-index.ts';

/**
 * Get the schema config for Class/Schema config, including support for polymorphism
 * @param base The starting type or config
 * @param item The item to use for the polymorphic check
 */
function resolveFieldMap<T>(base: Class<T>, item: T): SchemaFieldMap {
  const target = SchemaRegistryIndex.resolveInstanceType(base, item);
  return SchemaRegistryIndex.get(target).getFields();
}

function isClassInstance<T>(value: unknown): value is ClassInstance<T> {
  return !DataUtil.isPlainObject(value) && value !== null && typeof value === 'object' && !!value.constructor;
}

function isRangeValue(value: unknown): value is number | string | Date {
  return typeof value === 'string' || typeof value === 'number' || value instanceof Date;
}

/**
 * The schema validator applies the schema constraints to a given object and looks
 * for errors
 */
export class SchemaValidator {

  /**
   * Validate the schema for a given object
   * @param fields The config to validate against
   * @param item The object to validate
   * @param relative The relative path as the validation recurses
   */
  static #validateFields<T>(fields: SchemaFieldMap, item: T, relative: string): ValidationError[] {
    let errors: ValidationError[] = [];

    for (const [field, fieldConfig] of TypedObject.entries(fields)) {
      if (fieldConfig.access !== 'readonly') { // Do not validate readonly fields
        errors = errors.concat(this.#validateInputSchema(fieldConfig, item[castKey<T>(field)], relative));
      }
    }

    return errors;
  }

  /**
   * Validate a single input config against a passed in value
   * @param input The input schema configuration
   * @param value The raw value, could be an array or not
   * @param relative The relative path of object traversal
   */
  static #validateInputSchema(input: SchemaInputConfig, value: unknown, relative: string = ''): ValidationError[] {
    const key = 'name' in input ? input.name : ('index' in input ? input.index : 'unknown');
    const path = `${relative}${relative ? '.' : ''}${key}`;
    const hasValue = !(value === undefined || value === null || (typeof value === 'string' && value === '') || (Array.isArray(value) && value.length === 0));

    if (!hasValue) {
      if (input.required?.active !== false) {
        return this.#prepareErrors(path, [{ kind: 'required', active: true, ...input.required }]);
      } else {
        return [];
      }
    }

    const { type, array } = input;
    const complex = SchemaRegistryIndex.has(type);

    if (type === Object) {
      return [];
    } else if (array) {
      if (!Array.isArray(value)) {
        return this.#prepareErrors(path, [{ kind: 'type', type: Array, value }]);
      }
      let errors: ValidationError[] = [];
      if (complex) {
        for (let i = 0; i < value.length; i++) {
          const subErrors = this.#validateFields(resolveFieldMap(type, value[i]), value[i], `${path}[${i}]`);
          errors = errors.concat(subErrors);
        }
      } else {
        for (let i = 0; i < value.length; i++) {
          const subErrors = this.#validateInput(input, value[i]);
          errors.push(...this.#prepareErrors(`${path}[${i}]`, subErrors));
        }
      }
      return errors;
    } else if (complex) {
      return this.#validateFields(resolveFieldMap(type, value), value, path);
    } else {
      const fieldErrors = this.#validateInput(input, value);
      return this.#prepareErrors(path, fieldErrors);
    }
  }

  /**
   * Validate the range for a number, date
   * @param input The config to validate against
   * @param key The bounds to check
   * @param value The value to validate
   */
  static #validateRange(input: SchemaInputConfig, key: 'min' | 'max', value: string | number | Date): boolean {
    const config = input[key]!;
    const parsed = (typeof value === 'string') ?
      (input.type === Date ? Date.parse(value) : parseInt(value, 10)) :
      (value instanceof Date ? value.getTime() : value);

    const boundary = (typeof config.n === 'number' ? config.n : config.n.getTime());
    return key === 'min' ? parsed < boundary : parsed > boundary;
  }

  /**
   * Validate a given field by checking all the appropriate constraints
   *
   * @param input The config of the field to validate
   * @param value The actual value
   */
  static #validateInput(input: SchemaInputConfig, value: unknown): ValidationResult[] {
    const criteria: ([string, SchemaInputConfig[ValidationKindCore]] | [string])[] = [];

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
      const error: ValidationError = {
        ...result,
        kind: result.kind,
        value: result.value,
        message: '',
        re: CommonRegExpToName.get(result.re!) ?? result.re?.source ?? '',
        path,
        type: (typeof result.type === 'function' ? result.type.name : result.type)
      };

      if (!error.re) {
        delete error.re;
      }

      const msg = result.message ?? (
        Messages.get(error.re ?? '') ??
        Messages.get(error.kind) ??
        Messages.get('default')!
      );

      error.message = msg
        .replace(/\{([^}]+)\}/g, (_, key: (keyof ValidationError)) => `${error[key]}`);

      out.push(error);
    }
    return out;
  }

  /**
   * Validate the class level validations
   */
  static async #validateClassLevel<T>(cls: Class<T>, item: T, view?: string): Promise<ValidationError[]> {
    if (!SchemaRegistryIndex.has(cls)) {
      return [];
    }

    const classConfig = SchemaRegistryIndex.getConfig(cls);
    const errors: ValidationError[] = [];

    // Handle class level validators
    for (const fn of classConfig.validators) {
      try {
        const error = await fn(item, view);
        if (error) {
          if (Array.isArray(error)) {
            errors.push(...error);
          } else {
            errors.push(error);
          }
        }
      } catch (error: unknown) {
        if (isValidationError(error)) {
          errors.push(error);
        } else {
          throw error;
        }
      }
    }
    return errors;
  }

  /**
   * Validate an object against it's constructor's schema
   * @param cls The class to validate the objects against
   * @param item The object to validate
   * @param view The optional view to limit the scope to
   */
  static async validate<T>(cls: Class<T>, item: T, view?: string): Promise<T> {
    if (isClassInstance(item) && !(item instanceof cls || cls.Ⲑid === item.constructor.Ⲑid)) {
      throw new TypeMismatchError(cls.name, item.constructor.name);
    }
    cls = SchemaRegistryIndex.resolveInstanceType(cls, item);

    const fields = SchemaRegistryIndex.get(cls).getFields(view);

    // Validate using standard behaviors
    const errors = [
      ...this.#validateFields(fields, item, ''),
      ... await this.#validateClassLevel(cls, item, view)
    ];
    if (errors.length) {
      throw new ValidationResultError(errors);
    }

    return item;
  }

  /**
   * Validate an entire array of values
   * @param cls The class to validate the objects against
   * @param items The values to validate
   * @param view The view to limit by
   */
  static async validateAll<T>(cls: Class<T>, items: T[], view?: string): Promise<T[]> {
    return await Promise.all<T>((items ?? [])
      .map(item => this.validate(cls, item, view)));
  }

  /**
   * Validate partial, ignoring required fields as they are partial
   *
   * @param cls The class to validate against
   * @param item The value to validate
   * @param view The view to limit by
   */
  static async validatePartial<T>(cls: Class<T>, item: T, view?: string): Promise<T> {
    try {
      await this.validate(cls, item, view);
    } catch (error) {
      if (error instanceof ValidationResultError) { // Don't check required fields
        const errs = error.details.errors.filter(validationError => validationError.kind !== 'required');
        if (errs.length) {
          error.details.errors = errs;
          throw error;
        }
      }
    }
    return item;
  }

  /**
   * Validate method invocation
   *
   * @param cls The class to validate against
   * @param method The method being invoked
   * @param params The params to validate
   */
  static async validateMethod<T>(cls: Class<T>, method: string, params: unknown[], prefixes: (string | undefined)[] = []): Promise<void> {
    const errors: ValidationError[] = [];
    const config = SchemaRegistryIndex.get(cls).getMethod(method);

    for (const param of config.parameters) {
      const i = param.index;
      errors.push(...[
        ... this.#validateInputSchema(param, params[i]),
        ... await this.#validateClassLevel(param.type, params[i])
      ].map(error => {
        if (param.name && typeof param.name === 'string') {
          error.path = !prefixes[i] ?
            error.path.replace(`${param.name}.`, '') :
            error.path.replace(param.name, prefixes[i]!);
        }
        return error;
      }));
    }
    for (const validator of config.validators) {
      const error = await validator(...params);
      if (error) {
        if (Array.isArray(error)) {
          errors.push(...error);
        } else {
          errors.push(error);
        }
      }
    }
    if (errors.length) {
      throw new ValidationResultError(errors);
    }
  }
}