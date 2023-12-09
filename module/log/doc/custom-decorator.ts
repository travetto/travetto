import os from 'node:os';

import { Injectable } from '@travetto/di';
import { LogDecorator, LogEvent } from '@travetto/log';

@Injectable()
export class CustomDecorator implements LogDecorator {
  decorate(ev: LogEvent): LogEvent {

    // Add memory usage, and hostname
    Object.assign(ev.context ??= {}, {
      memory: process.memoryUsage,
      hostname: os.hostname()
    });

    return ev;
  }
}