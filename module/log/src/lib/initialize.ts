import * as log4js from 'log4js';
import { addLayout } from 'log4js/lib/layouts';

import Config from './config';
import { Layouts } from './layout';
import { isFileAppender } from './types';
import { simpleName } from '@encore/base/info';
import * as mkdirp from 'mkdirp';

let appenders = Object
  .keys(Config.appenders)
  .reduce((acc, name) => {
    let conf = (Config.appenders as any)[name];
    if (!conf.hasOwnProperty('enabled') || conf.enabled) {
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

      if (conf.level) {
        acc[`_${name}`] = conf;
        conf = {
          type: 'logLevelFilter',
          appender: `_${name}`,
          level: conf.level,
          maxLevel: conf.maxLevel || 'fatal'
        }
      }

      acc[name] = conf!;
    }
    return acc;
  }, {} as { [key: string]: log4js.Appender });

let categories = Object
  .keys(Config.categories)
  .reduce((acc, name) => {
    acc[name] = (Config.categories as any)[name];
    if (typeof acc[name].appenders === 'string') {
      acc[name].appenders = (acc[name].appenders as any as string).split(',').map(x => x.trim())
    }
    return acc;
  }, {} as { [key: string]: log4js.Category })

for (let layout of Object.keys(Layouts)) {
  addLayout(layout, Layouts[layout]);
}

log4js.configure({
  appenders,
  categories
});

if (Config.appenders.console) {
  let override: boolean | null = Config.appenders.console.replaceConsole;

  if (override === null ? process.env.env !== 'test' : !!override) {
    const logger = log4js.getLogger('console');
    for (let key of ['info', 'warn', 'error', 'debug']) {
      if (key in console && key in logger) {
        (console as any)[key] = (logger as any)[key].bind(logger);

      }
    }
    console.log = logger.info.bind(logger);
  }
}
