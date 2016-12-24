import Config from './config';
import * as winston from 'winston';
import { nodeToPromise } from '@encore/util';
import { processTransportConfig } from './transport';
import { LoggerExtra, AsyncLog, AsyncLogLevel } from './types';


let primitives: { [key: string]: boolean } = {
  boolean: true, string: true, number: true, undefined: true
};

function asyncLog(log: any, extra: LoggerExtra) {
  return async (level: string, ...args: any[]) => {
    args = args || [];

    let last = args[args.length - 1];
    if (last === null || primitives[typeof last]) {
      args.push(last = {});
    }

    last.__extra = extra;

    return await nodeToPromise<void>(log, log[level], ...args);
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
    return new LoggerWrapper({ scope });
  }

  constructor(extra: LoggerExtra) {
    this.log = asyncLog(logger, extra);
    for (let k of ['error', 'info', 'debug', 'warn', 'verbose', 'silly']) {
      (this as any)[k] = asyncLog(logger, extra).bind(null, k);
    }
  }
}

export const Logger = new LoggerWrapper({ scope: 'default' });
export const WinstoLogger = logger;

if (Config.console) {
  let override: boolean | null = Config.console.overrideNative;
  if (override === null) {
    override = (process.env.env !== 'test' as any);
  }

  if (override) {
    let consLogger = Logger.scope('console');
    console.log = consLogger.info.bind(consLogger);
    console.info = consLogger.info.bind(consLogger);
    console.warn = consLogger.warn.bind(consLogger);
    console.error = consLogger.error.bind(consLogger);
    console.debug = consLogger.debug.bind(consLogger);
  }
}