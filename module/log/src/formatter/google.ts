import util from 'node:util';

import { Injectable } from '@travetto/di';

import { LogFormatter, LogEvent } from '../types';

/**
 * Google Logging Formatter
 *
 * Provides a standard google logging provider that adapts the content for google's logging structure
 */
@Injectable()
export class GoogleLogFormatter implements LogFormatter {
  #inspectOptions = { colors: false, showHidden: false, depth: 5, breakLength: 200 };

  format({
    source: file, line, scope, level, message, timestamp, module, args,
    context: { method, path, statusCode, ...context } = {},
  }: LogEvent): string {
    const final: unknown[] = [...args];
    if (message) {
      args.unshift(message);
    }
    if (Object.keys(context).length) {
      args.push(context);
    }
    return JSON.stringify({
      context,
      'logging.googleapis.com/sourceLocation': { file, line },
      'logging.googleapis.com/labels': { module, scope },
      severity: level,
      message: util.formatWithOptions(this.#inspectOptions, final),
      timestamp,
      ...(method ? {
        httpRequest: {
          requestMethod: method,
          requestUrl: path,
          status: statusCode
        }
      } : {})
    });
  }
}