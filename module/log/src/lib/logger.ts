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

if (Config.console) {
  let override: boolean | null = Config.console.overrideNative;
  if (override === null) {
    override = (process.env.env !== 'test' as any);
  }

  if (override) {
    let consLogger = Logger.scope('[console]');
    console.log = consLogger.info.bind(consLogger);
    console.info = consLogger.info.bind(consLogger);
    console.warn = consLogger.warn.bind(consLogger);
    console.error = consLogger.error.bind(consLogger);
    console.debug = consLogger.debug.bind(consLogger);
  } else {
    console.debug = console.log;
  }
}