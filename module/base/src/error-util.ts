import { path } from '@travetto/manifest';

import { TypedObject } from './types';
import { ObjectUtil } from './object';

export type SerializedError = { $?: boolean, message: string, stack?: string, name: string };

function isSerialized(e: unknown): e is SerializedError {
  return !!e && (typeof e === 'object') && '$' in e;
}

const DEFAULT_NAMES = [
  '@travetto/context',
  'src/stacktrace',
  'internal',
  '(?:Array.*?<anonymous>)',
  'async_hooks',
  '[(]native[)]',
  'typescript',
  'tslib',
  'source-map-support'
];

const DEFAULT_FILTER = new RegExp(`(${DEFAULT_NAMES.join('|')})`);

/**
 * Common error utilities
 */
export class ErrorUtil {

  /**
   *  Prepare error for transmission
   */
  static serializeError(e: Error | SerializedError): SerializedError;
  static serializeError(e: undefined): undefined;
  static serializeError(e: Error | SerializedError | undefined): SerializedError | undefined {
    let error: SerializedError | undefined;

    if (e) {
      error = { $: true, name: e.name, message: '' };
      for (const k of TypedObject.keys<{ name: string }>(e)) {
        error[k] = e[k];
      }
      error.name = e.name;
      if (ObjectUtil.hasToJSON(e)) {
        Object.assign(error, e.toJSON());
      }
      error.message ??= e.message;
      error.stack ??= e.stack;
    }

    return error;
  }

  /**
   * Reconstitute the error, post serialization
   */
  static deserializeError(e: Error | SerializedError): Error;
  static deserializeError(e: undefined): undefined;
  static deserializeError(e: Error | SerializedError | undefined): Error | undefined {
    if (isSerialized(e)) {
      const err = new Error();

      for (const k of TypedObject.keys<{ name: string }>(e)) {
        err[k] = e[k];
      }
      err.message = e.message;
      err.stack = e.stack;
      err.name = e.name;
      return err;
    } else if (e) {
      return e;
    }
  }

  /**
   * Clean up the stack output for an error
   * @param err The error to filter
   * @param filter Should the stack be filtered
   */
  static cleanStack(err: Error | string, filter: RegExp = DEFAULT_FILTER): string {
    let lastLocation: string = '';
    const cwd = path.cwd();
    const cwdPrefix = `${cwd}/`;
    const errText = path.toPosix(typeof err === 'string' ? err : err.stack!);
    const body = errText
      .split('\n')
      .filter(x => filter.test(x))
      .reduce<string[]>((acc, line) => {
        const [, location] = line.split(cwd);

        if (location === lastLocation) {
          // Do nothing
        } else {
          if (location) {
            lastLocation = location;
          }
          acc.push(line);
        }
        return acc;
      }, [])
      .map(x => x
        .replace(cwdPrefix, './')
        .replace(/^[\/]+/, '')
      );

    if (!filter || body.length > 2) {
      return body.join('  \n');
    } else {
      return errText;
    }
  }
}