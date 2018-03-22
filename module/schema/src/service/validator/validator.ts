import { FieldConfig, SchemaConfig } from '../types';
import { SchemaRegistry } from '../registry';
import { Messages } from './messages';
import { Class } from '@travetto/registry';

export type ValidationError = { message: string, path: string, kind: string };

export class SchemaValidator {

  static validateField(field: FieldConfig, value: any) {
    const criteria: string[] = [];

    if (
      (field.type === String && (typeof value !== 'string')) ||
      (field.type === Number && ((typeof value !== 'number') || Number.isNaN(value))) ||
      (field.type === Date && (typeof value !== 'number' && !(value instanceof Date))) ||
      (field.type === Boolean && typeof value !== 'boolean')
    ) {
      criteria.push('type');
      return [{ kind: 'type', type: field.type }]
    }

    if (field.match && !field.match.re.test(`${value}`)) {
      criteria.push('match');
    }

    if (field.minlength && `${value}`.length < field.minlength.n) {
      criteria.push('minlength');
    }

    if (field.maxlength && `${value}`.length > field.maxlength.n) {
      criteria.push('maxlength');
    }

    if (field.enum && !field.enum.values.includes(value)) {
      criteria.push('enum');
    }

    if (field.min) {
      if (typeof field.min.n === 'number') {
        if (typeof value !== 'number') {
          value = parseInt(value, 10);
        }
        if (value < field.min.n) {
          criteria.push('min');
        }
      } else {
        const date = field.min.n.getTime();
        if (typeof value === 'string') {
          value = Date.parse(value);
        }
        if (value < date) {
          criteria.push('min');
        }
      }
    }

    if (field.max) {
      if (typeof field.max.n === 'number') {
        if (typeof value !== 'number') {
          value = parseInt(value, 10);
        }
        if (value > field.max.n) {
          criteria.push('max');
        }
      } else {
        const date = field.max.n.getTime();
        if (typeof value === 'string') {
          value = Date.parse(value);
        }
        if (value > date) {
          criteria.push('max');
        }
      }
    }

    const errors: ValidationError[] = [];
    for (const key of criteria) {
      const block = (field as any)[key];
      errors.push({ ...block, kind: key, value });
    }
    return errors;
  }

  static prepareErrors(path: string, errs: any[]) {
    const out = [];
    for (const err of errs) {
      const message = err.message || (err.kind === 'match' ? Messages.get(err.re) : Messages.get(err.kind))
      if (message) {
        err.path = path;
        err.message = message.replace(/\{([^}]+)\}/g, (a: string, k: string) => err[k]);
        out.push(err);
      }
    }
    return out;
  }

  private static validateSchema<T>(schema: SchemaConfig, o: T, view: string | undefined, relative: string) {
    let errors: ValidationError[] = [];

    for (const field of Object.keys(schema)) {
      const fieldSchema = schema[field];
      const val = (o as any)[field];
      const path = `${relative}${relative && '.'}${field}`;

      const hasValue = !(val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0));

      if (!hasValue) {
        if (fieldSchema.required) {
          errors.push(...this.prepareErrors(path, [{ kind: 'required' }]));
        }
        continue;
      }

      const { type, array } = fieldSchema.declared;

      let sub: SchemaConfig | undefined;
      if (SchemaRegistry.has(type)) {
        sub = SchemaRegistry.getViewSchema(type, view).schema;
      } else if (type === Object) {
        sub = type as any as SchemaConfig;
      }

      if (array) {
        if (!Array.isArray(val)) {
          errors = errors.concat(this.prepareErrors(path, [{ kind: 'type', type: Array, value: val }]));
          continue;
        }
        if (sub) {
          for (let i = 0; i < val.length; i++) {
            const subErrors = this.validateSchema(sub, val[i], view, `${path}[${i}]`);
            errors = errors.concat(subErrors);
          }
        } else {
          for (let i = 0; i < val.length; i++) {
            const subErrors = this.validateField(fieldSchema, val[i]);
            errors.push(...this.prepareErrors(`${path}[${i}]`, subErrors));
          }
        }
      } else if (sub) {
        const subErrors = this.validateSchema(sub, val, view, path);
        errors.push(...subErrors);
      } else {
        const fieldErrors = this.validateField(fieldSchema, val);
        errors.push(...this.prepareErrors(path, fieldErrors));
      }
    }

    return errors;
  }

  static async validate<T>(o: T, view?: string): Promise<T> {
    const cls = o.constructor as Class;
    const config = SchemaRegistry.getViewSchema(cls, view);

    const errors = this.validateSchema(config.schema, o, view, '');

    if (errors.length) {
      throw { errors };
    }

    return o;
  }

  static async validateAll<T>(obj: T[], view?: string): Promise<T[]> {
    return await Promise.all<T>((obj || [])
      .map((o, i) => this.validate(o, view)));
  }
}