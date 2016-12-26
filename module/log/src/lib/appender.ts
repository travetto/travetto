import * as log4js from 'log4js';
import * as mkdirp from 'mkdirp';
import { isFileAppender, BaseConfig } from './types';
import { simpleName } from '@encore/base/info';

export function processAppenderConfig<T extends BaseConfig>(conf: T): log4js.Appender | undefined {
  if (isFileAppender(conf)) {
    if (!conf.filename) {
      conf.filename = `${simpleName}-${conf.name}.log`;
    }
    if (!conf.filename.startsWith('/')) {
      conf.filename = `${process.cwd()}/logs/${conf.filename}`;
      conf.absolute = true;
    }

    // Setup folder for logging
    mkdirp.sync(conf.filename.substring(0, conf.filename.lastIndexOf('/')));
  }

  conf.level = conf.level || 'info';

  log4js.loadAppender(conf.type);

  return require(`log4js/appenders/${conf.type}`).configure(conf) as log4js.Appender;
}