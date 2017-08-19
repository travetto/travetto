import * as log4js from 'log4js';
import * as mkdirp from 'mkdirp';
import { isFileAppender, BaseConfig } from './types';
import { simpleName } from '@encore/base/info';

export function processAppenderConfig<T extends BaseConfig>(conf: T): log4js.Appender | undefined {
  if (isFileAppender(conf)) {
    if (!conf.filename) {
      conf.filename = simpleName;
      if (conf.name) {
        conf.filename += `-${conf.name}`;
      }
      conf.filename += '.log';
    }
    if (!conf.filename.startsWith('/')) {
      conf.filename = `${process.cwd()}/logs/${conf.filename}`;
      conf.absolute = true;
    }

    // Setup folder for logging
    mkdirp.sync(conf.filename.substring(0, conf.filename.lastIndexOf('/')));
  }

  conf.level = conf.level || 'info';

  let appender = require(`log4js/lib/appenders/${conf.type}`).configure(conf) as log4js.Appender;
  let filtered = require(`log4js/lib/appenders/logLevelFilter`).configure({
    level: conf.level,
    maxLevel: 'fatal',
    appender
  }) as log4js.Appender;

  return filtered;
}