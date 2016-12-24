export type AsyncLogLevel = (msg: string, ...args: any[]) => Promise<void>;
export type AsyncLog = (level: string, msg: string, ...args: any[]) => Promise<void>;

export interface LoggerExtra {
  scope?: string;
}

export interface BaseConfig {
  type: string;
  enabled: boolean;
  formatter?: string;
  level?: string;
}

export interface ConsoleConfig extends BaseConfig {
  type: 'console',
  timestamp?: boolean;
  colorize?: boolean;
  align?: boolean;
  overrideNative: boolean | null;
  prettyPrint?: boolean;
}

export interface FileConfig extends BaseConfig {
  type: 'file';
  name?: string;
  filename?: string;
}

export interface HttpConfig extends BaseConfig {
  type: 'http';
}

export function isFileTransport(conf: any): conf is FileConfig {
  return conf.type === 'file';
}

export function isConsoleTransport(conf: any): conf is ConsoleConfig {
  return conf.type === 'console';
}

export function isHttpTransport(conf: any): conf is HttpConfig {
  return conf.type === 'http';
}

export interface LoggingContext {
  level: string;
  colorize: boolean;
  showLevel: boolean;
  timestamp: boolean;
  meta?: any;
  align: boolean;
  message?: string;
  prettyPrint: boolean;
}