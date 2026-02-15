import { JSONUtil } from '@travetto/runtime';
import { Injectable } from '@travetto/di';

import type { LogFormatter, LogEvent } from '../types.ts';
import { LogFormatUtil } from './util.ts';

/**
 * Google Logging Formatter
 *
 * Provides a standard google logging provider that adapts the content for google's logging structure
 */
@Injectable()
export class GoogleLogFormatter implements LogFormatter {
  format(event: LogEvent): string {
    const context = LogFormatUtil.getContext(event);

    const extra: Record<string, unknown> = {};
    // Http request specific
    if (context && ('method' in context && 'path' in context && 'statusCode' in context)) {
      extra.httpRequest = {
        requestMethod: context.method,
        requestUrl: context.path,
        status: context.statusCode
      };
      delete context.method;
      delete context.path;
      delete context.statusCode;
    }

    return JSONUtil.toUTF8({
      context,
      'logging.googleapis.com/sourceLocation': { file: `${event.module}/${event.modulePath}`, line: event.line },
      'logging.googleapis.com/labels': { module: event.module, scope: event.scope },
      severity: event.level,
      message: LogFormatUtil.getLogMessage(event),
      timestamp: event.timestamp,
      ...extra,
    });
  }
}