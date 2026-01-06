import { Injectable } from '@travetto/di';
import { type LogFormatter, LogCommonSymbol, type LogEvent } from '@travetto/log';

@Injectable(LogCommonSymbol)
export class SampleFormatter implements LogFormatter {

  format(event: LogEvent): string {
    return `${event.timestamp} [${event.level}]#[${event.scope ?? 'unknown'}] ${event.message ?? 'NO MESSAGE'} ${(event.args ?? []).join(' ')}`;
  }
}