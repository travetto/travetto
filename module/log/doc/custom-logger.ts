import { Injectable } from '@travetto/di';
import type { LogEvent, Logger } from '@travetto/log';
import { JSONUtil } from '@travetto/runtime';

@Injectable()
export class CustomLogger implements Logger {
  log(event: LogEvent): void {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    const body = JSONUtil.toUTF8(event);
    fetch('http://localhost:8080/log', { method: 'POST', headers, body, });
  }
}