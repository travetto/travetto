import { Injectable } from '@travetto/di';
import { LogFormatter, LogCommonSymbol, LogEvent } from '@travetto/log';

@Injectable(LogCommonSymbol)
export class SampleFormatter implements LogFormatter {

  format(e: LogEvent): string {
    return `${e.timestamp} [${e.level}]#[${e.scope ?? 'unknown'}] ${e.message ?? 'NO MESSAGE'} ${(e.args ?? []).join(' ')}`;
  }
}