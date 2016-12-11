import Config from './config';
import * as winston from 'winston';
import { nodeToPromise } from '@encore/util';
import { processTransportConfig } from './transport';

type AsyncLogLevel = (msg: string, ...meta: any[]) => Promise<void>;
type AsyncLog = (level: string, msg: string, ...meta: any[]) => Promise<void>;

function asyncLog(log: any, scope: string) {
  return async (level: string, msg: string, ...meta: any[]) => {
    if (scope) {
      msg = msg ? `${scope} ${msg}` : scope;
    }
    return await nodeToPromise<void>(log, log[level], msg, ...meta);
  };
}

let transports = Object
  .keys(Config)
  .map(name => {
    let conf = (Config as any)[name];
    if (!conf.hasOwnProperty('enabled') || conf.enabled) {
      return processTransportConfig(conf);
    }
  })
  .filter(x => x !== undefined) as winston.TransportInstance[];

let logger = new winston.Logger({ transports });

class LoggerWrapper {

  log: AsyncLog;
  error: AsyncLogLevel;
  info: AsyncLogLevel;
  debug: AsyncLogLevel;
  warn: AsyncLogLevel;
  verbose: AsyncLogLevel;
  silly: AsyncLogLevel;

  scope(scope: string) {
    return new LoggerWrapper(scope);
  }

  constructor(scope: string = '') {
    this.log = asyncLog(logger, scope);
    for (let k of ['error', 'info', 'debug', 'warn', 'verbose', 'silly']) {
      (this as any)[k] = asyncLog(logger, scope).bind(null, k);
    }
  }
}

export const Logger = new LoggerWrapper('');
export const WinstoLogger = logger;