import { Injectable } from '@travetto/di';

import { LogFormatter, LogEvent } from '../types';
import { LogFormatUtil } from './util';

/**
 * Google Logging Formatter
 *
 * Provides a standard google logging provider that adapts the content for google's logging structure
 */
@Injectable()
export class GoogleLogFormatter implements LogFormatter {
  format(ev: LogEvent): string {
    const context = LogFormatUtil.getContext(ev);

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

    return JSON.stringify({
      context,
      'logging.googleapis.com/sourceLocation': { file: `${ev.module}/${ev.modulePath}`, line: ev.line },
      'logging.googleapis.com/labels': { module: ev.module, scope: ev.scope },
      severity: ev.level,
      message: LogFormatUtil.getLogMessage(ev),
      timestamp: ev.timestamp,
      ...extra,
    });
  }
}