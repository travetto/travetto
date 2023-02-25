import fetch, { Headers } from 'node-fetch';

import { Injectable } from '@travetto/di';
import { LogEvent, Logger } from '@travetto/log';

@Injectable()
export class CustomLogger implements Logger {
  onLog(ev: LogEvent): void {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    const body = JSON.stringify(ev);
    fetch('http://localhost:8080/log', { method: 'POST', headers, body, });
  }
}