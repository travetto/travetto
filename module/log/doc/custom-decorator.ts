import os from 'node:os';

import { Injectable } from '@travetto/di';
import { LogDecorator, LogEvent } from '@travetto/log';

@Injectable()
export class CustomDecorator implements LogDecorator {
  decorate(event: LogEvent): LogEvent {
    event.args.push({
      memory: process.memoryUsage,
      hostname: os.hostname()
    });
    return event;
  }
}