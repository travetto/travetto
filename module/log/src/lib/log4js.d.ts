declare module "log4js/types" {
  export enum LevelType {
    INFO = 'INFO',
    DEBUG = 'DEBUG',
    WARN = 'WARN',
    TRACE = 'TRACE',
    FATAL = 'FATAL',
    ERROR = 'ERROR'
  }

  export class LevelConfig {
    level: LevelType;
    levelStr: string;
    colour: string;
  }

  export class Level extends LevelConfig {
    isLessThanOrEqualTo(level: string | Level): boolean;
    isGreaterThanOrEqualTo(level: string | Level): boolean;
    isEqualTo(level: string | Level): boolean;
  }

  export class LogEvent<T = any> {
    startTime: Date;
    categoryName: string;
    data: T;
    level: Level;
    context: any;
    pid: number;
    cluster?: {
      workerId: string;
      worker: number;
    }
  }

  export type Layout = (event: LogEvent, timezoneOffset?: number) => string
  export type Appender = (config: any, layouts: { [key: string]: Layout }) => any;

  export class Category {
    appenders: string[];
    level: LevelType | string;
  }

  export type Levels =
    { getLevel(key: LevelType | Level): Level } &
    {
      [key: string]: Level
    };

  export class Logger {
    category: string;
    dispatch: () => void;
    context: any;
    level: string;
    log(level: LevelType, ...rest: any[]): void;
    isLevelEnabled(level: LevelType): boolean;
    addContext(key: string, value: any): void;
    removeContext(key: string): void;
    clearContext(): void;
    info(...rest: any[]): void;
    debug(...rest: any[]): void;
    warn(...rest: any[]): void;
    trace(...rest: any[]): void;
    fatal(...rest: any[]): void;
    error(...rest: any[]): void;
  }
  export class LoggerOptions {

  }

  export class LogConfiguration {
    appenders: { [key: string]: Appender };
    categories?: { [key: string]: Category };
    pm2?: any;
    pm2InstanceVar?: any;
    levels?: {
      [key: string]: LevelConfig
    };
    configuredLevels?: Levels
  }
}

declare module 'log4js/layouts' {
  import * as all from 'log4js/types';

  export const basicLayout: all.Layout;
  export const messagePassThroughLayout: all.Layout;
  export const patternLayout: all.Layout;
  export const colouredLayout: all.Layout;
  export const coloredLayout: all.Layout;
  export const dummyLayout: all.Layout;
  export function addLayout(name: string, layout: (opts: any) => all.Layout): void;
  export function layout(name: string, config: any): void;
}

declare module 'log4js' {
  import * as all from 'log4js/types';

  export function getLogger(category?: string): all.Logger;
  export function configure(config: string | all.LogConfiguration): void;
  export function shutdown(callback: (error?: any) => any): void;
  export function connectLogger(logger: all.Logger, options: all.LoggerOptions): (req: any, res: any, next?: (err?: any) => any) => any;
  export function addLayout(name: string, layout: (config?: any) => string): void;
  export const levels: all.Levels;
  export * from 'log4js/types';
}