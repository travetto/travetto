import * as log4js from 'log4js';

import Config from './config';
import './layout';
import { processAppenderConfig } from './appender';

export const logger = log4js.getLogger();
export const Logger = logger;

log4js.clearAppenders();

Object
  .keys(Config)
  .map(name => {
    let conf = (Config as any)[name];
    if (!conf.hasOwnProperty('enabled') || conf.enabled) {
      return processAppenderConfig(conf);
    }
  })
  .filter(x => x !== undefined)
  .forEach(x => log4js.addAppender(x));


if (Config.console) {
  let override: boolean | null = Config.console.replaceConsole;

  if (override === null ? process.env.env !== 'test' : !!override) {
    log4js.replaceConsole();
  }
}