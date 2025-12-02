import { castKey, castTo, getClass } from '@travetto/runtime';
import { BindUtil, SchemaRegistryIndex, SchemaValidator, ValidationResultError } from '@travetto/schema';

import { ParsedState, CliCommandShape, CliValidationError } from './types.ts';
import { CliValidationResultError } from './error.ts';

const getSource = (source: string | undefined, def: CliValidationError['source']): CliValidationError['source'] => {
  switch (source) {
    case 'custom':
    case 'arg':
    case 'flag': return source;
    case undefined: return def;
    default: return 'custom';
  }
};

/**
 * Allows binding describing/binding inputs for commands
 */
export class CliCommandSchemaUtil {
  /**
   * Bind parsed inputs to command
   */
  static bindInput<T extends CliCommandShape>(cmd: T, state: ParsedState): unknown[] {
    const template: Partial<T> = {};
    const bound: unknown[] = [];

    for (const arg of state.all) {
      switch (arg.type) {
        case 'flag': {
          const key = castKey<T>(arg.fieldName);
          const value = arg.value!;
          if (arg.array) {
            castTo<unknown[]>(template[key] ??= castTo([])).push(value);
          } else {
            template[key] = castTo(value);
          }
          break;
        }
        case 'arg': {
          if (arg.array) {
            castTo<unknown[]>(bound[arg.index] ??= []).push(arg.input);
          } else {
            bound[arg.index] = arg.input;
          }
        }
      }
    }

    const cls = getClass(cmd);
    BindUtil.bindSchemaToObject(cls, cmd, template);
    return BindUtil.coerceMethodParams(cls, 'main', bound);
  }

  /**
   * Validate command shape with the given arguments
   */
  static async validate(cmd: CliCommandShape, args: unknown[]): Promise<typeof cmd> {
    const cls = getClass(cmd);
    const paramNames = SchemaRegistryIndex.get(cls).getMethod('main').parameters.map(x => x.name!);

    const validators = [
      (): Promise<void> => SchemaValidator.validate(cls, cmd).then(() => { }),
      (): Promise<void> => SchemaValidator.validateMethod(cls, 'main', args, paramNames),
      async (): Promise<void> => {
        const result = await cmd.validate?.(...args);
        if (result) {
          throw new CliValidationResultError(cmd, Array.isArray(result) ? result : [result]);
        }
      },
    ];

    const SOURCES = ['flag', 'arg', 'custom'] as const;

    const results = validators.map((x, i) => x().catch(error => {
      if (!(error instanceof CliValidationResultError) && !(error instanceof ValidationResultError)) {
        throw error;
      }
      return error.details.errors.map(value => ({ ...value, source: getSource(value.source, SOURCES[i]) }));
    }));

    const errors = (await Promise.all(results)).flatMap(x => (x ?? []));
    if (errors.length) {
      throw new CliValidationResultError(cmd, errors);
    }
    return cmd;
  }
}