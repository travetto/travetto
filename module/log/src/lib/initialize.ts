import * as log4js from 'log4js';
import { addLayout } from 'log4js/lib/layouts';

import Config from './config';
import { Layouts } from './layout';
import { processAppenderConfig } from './appender';

let appenders = Object
  .keys(Config.appenders)
  .reduce((acc, name) => {
    let conf = (Config.appenders as any)[name];
    if (!conf.hasOwnProperty('enabled') || conf.enabled) {
      acc[name] = processAppenderConfig(conf)!;
    }
    return acc;
  }, {} as { [key: string]: log4js.Appender });

let categories = Object
  .keys(Config.categories)
  .reduce((acc, name) => {
    acc[name] = categories[name];
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
    for (let key of Object.keys(log4js.LevelType)) {
      if (key in console && key in logger) {
        (console as any)[key] = (logger as any)[key].bind(logger);

      }
    }
    console.log = logger.info.bind(logger);
  }
}
