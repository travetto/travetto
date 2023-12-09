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
  format({
    source: file, line, scope, level, message, timestamp, module, args,
    context: { method, path, statusCode, ...context } = {},
  }: LogEvent): string {
    return JSON.stringify({
      context,
      'logging.googleapis.com/sourceLocation': { file, line },
      'logging.googleapis.com/labels': { module, scope },
      severity: level,
      message: util.format(message, ...args, ...Object.entries(context).map(([k, v]) => util.format('%s=%s', k, v))),
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