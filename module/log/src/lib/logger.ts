import Config from './config';
import * as winston from 'winston';
import { nodeToPromise } from '@encore/util';
import { processTransportConfig } from './transport';

function asyncLogLevel(log: any, level: string) {
  return async (msg: string, ...meta: any[]) => await nodeToPromise<void>(log, log[level], msg, ...meta);
}

function asyncLog(log: any) {
  return async (level: string, msg: string, ...meta: any[]) => await nodeToPromise<void>(log, log[level], msg, ...meta);
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

export const Logger = {
  log: asyncLog(logger),
  error: asyncLogLevel(logger, 'error'),
  info: asyncLogLevel(logger, 'info'),
  debug: asyncLogLevel(logger, 'debug'),
  warn: asyncLogLevel(logger, 'warn'),
  verbose: asyncLogLevel(logger, 'verbose'),
  silly: asyncLogLevel(logger, 'silly')
}

export const SysLogger = {
  log: asyncLog(logger),
  emerg: asyncLogLevel(logger, 'emerg'),
  alert: asyncLogLevel(logger, 'alert'),
  crit: asyncLogLevel(logger, 'crit'),
  warning: asyncLogLevel(logger, 'warning'),
  notice: asyncLogLevel(logger, 'notice'),
  error: asyncLogLevel(logger, 'error'),
  info: asyncLogLevel(logger, 'info'),
  debug: asyncLogLevel(logger, 'debug'),
};

export const WinstoLogger = logger;
