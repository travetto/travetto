import { castKey, castTo, getClass } from '@travetto/runtime';
import { BindUtil, SchemaRegistryIndex, SchemaValidator, ValidationResultError, type ValidationError } from '@travetto/schema';

import type { ParsedState, CliCommandShape } from './types.ts';

const getSource = (source: string | undefined, defaultSource: ValidationError['source']): ValidationError['source'] => {
  switch (source) {
    case 'custom':
    case 'arg':
    case 'flag': return source;
    case undefined: return defaultSource;
    default: return 'custom';
  }
};

const transformErrors = (source: 'arg' | 'flag', error: unknown): ValidationError[] => {
  if (error instanceof ValidationResultError) {
    return error.details.errors.map(value => ({ source: getSource(value.source, source), ...value }));
  } else {
    throw error;
  }
};

const transformArgErrors = (error: unknown): ValidationError[] => transformErrors('arg', error);
const transformFlagErrors = (error: unknown): ValidationError[] => transformErrors('flag', error);

/**
 * Allows binding describing/binding inputs for commands
 */
export class CliCommandSchemaUtil {
  /**
   * Bind parsed inputs to command
   */
  static bindInput<T extends CliCommandShape>(command: T, state: ParsedState): unknown[] {
    const template: Partial<T> = {};
    const bound: unknown[] = [];

    for (const item of state.all) {
      switch (item.type) {
        case 'flag': {
          const key = castKey<T>(item.fieldName);
          const value = item.value!;
          if (item.array) {
            castTo<unknown[]>(template[key] ??= castTo([])).push(value);
          } else {
            template[key] = castTo(value);
          }
          break;
        }
        case 'arg': {
          if (item.array) {
            castTo<unknown[]>(bound[item.index] ??= []).push(item.input);
          } else {
            bound[item.index] = item.input;
          }
        }
      }
    }

    const cls = getClass(command);
    BindUtil.bindSchemaToObject(cls, command, template);
    return BindUtil.coerceMethodParams(cls, 'main', bound);
  }

  /**
   * Validate command shape with the given arguments
   */
  static async validate(command: CliCommandShape, args: unknown[]): Promise<typeof command> {
    const cls = getClass(command);
    const paramNames = SchemaRegistryIndex.get(cls).getMethod('main').parameters.map(config => config.name!);

    const results = await Promise.all([
      SchemaValidator.validate(cls, command).then(() => [], transformFlagErrors),
      SchemaValidator.validateMethod(cls, 'main', args, paramNames).then(() => [], transformArgErrors),
    ]);

    const errors = results.flat();
    if (errors.length) {
      throw new ValidationResultError(errors);
    }
    return command;
  }
}