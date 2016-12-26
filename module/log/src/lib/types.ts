export interface BaseConfig {
  type: string;
  enabled: boolean;
  level?: string;
}

export interface StandardLayout {
  type: 'standard';
  timestamp?: boolean;
  level?: boolean;
  colorize?: boolean;
  align?: boolean;
  prettyPrint?: boolean;
}

export interface JsonLayout {
  type: 'json';
}

export interface ConsoleConfig extends BaseConfig {
  type: 'console',
  layout?: StandardLayout,
  replaceConsole: boolean | null;
}

export interface FileConfig extends BaseConfig {
  type: 'file';
  name?: string;
  filename?: string;
  absolute?: boolean;
  maxLogSize?: string;
  backups?: number;
  layout?: JsonLayout;
}

export interface HttpConfig extends BaseConfig {
  type: 'http';
}

export function isFileAppender(conf: any): conf is FileConfig {
  return conf.type === 'file';
}

export function isConsoleAppender(conf: any): conf is ConsoleConfig {
  return conf.type === 'console';
}

export function isHttpAppender(conf: any): conf is HttpConfig {
  return conf.type === 'http';
}

export interface LogContext {
  timestamp: string;
  level: string;
  category: string;
  message?: string;
  meta?: any;
}