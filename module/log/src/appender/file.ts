import { createWriteStream, type WriteStream, mkdirSync, openSync, appendFileSync } from 'node:fs';
import path from 'node:path';

import { Env, Runtime } from '@travetto/runtime';
import { Injectable } from '@travetto/di';
import { Config, EnvVar } from '@travetto/config';

import type { LogAppender, LogEvent } from '../types.ts';

@Config('log')
export class FileLogAppenderConfig {
  @EnvVar(Env.TRV_LOG_OUTPUT.key)
  output?: 'file' | string;

  writeSync = false;

  postConstruct(): void {
    if (!this.output || this.output === 'file' || this.output === 'console') {
      this.output = Runtime.toolPath('@', 'output.log');
    }
  }
}

/**
 * File Logging Appender
 */
@Injectable()
export class FileLogAppender implements LogAppender {
  stream?: WriteStream;
  appendDescriptor?: number;

  constructor(config: FileLogAppenderConfig) {
    mkdirSync(path.dirname(config.output!), { recursive: true });
    if (config.writeSync) {
      this.appendDescriptor = openSync(config.output!, 'a');
    } else {
      this.stream = createWriteStream(config.output!, { autoClose: true, flags: 'a' });
    }
  }

  append(event: LogEvent, formatted: string): void {
    if (this.stream) {
      this.stream.write(`${formatted}\n`);
    } else {
      appendFileSync(this.appendDescriptor!, `${formatted}\n`);
    }
  }
}