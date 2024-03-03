export type CompilerMode = 'build' | 'watch';

export type CompilerStateType = 'startup' | 'init' | 'compile-start' | 'compile-end' | 'watch-start' | 'watch-end' | 'reset' | 'closed';
export type CompilerChangeEvent = { file: string, action: 'create' | 'update' | 'delete', output: string, module: string, time: number };
export type CompilerLogLevel = 'info' | 'debug' | 'warn' | 'error';
export type CompilerLogEvent = { level: CompilerLogLevel, message: string, time?: number, args?: unknown[], scope?: string };
export type CompilerProgressEvent = { idx: number, total: number, message: string, operation: 'compile', complete?: boolean };
export type CompilerStateEvent = { state: CompilerStateType, extra?: Record<string, unknown> };

export type CompilerEvent =
  { type: 'change', payload: CompilerChangeEvent } |
  { type: 'log', payload: CompilerLogEvent } |
  { type: 'progress', payload: CompilerProgressEvent } |
  { type: 'state', payload: CompilerStateEvent };

export type CompilerEventType = CompilerEvent['type'];

export type CompilerServerInfo = {
  path: string;
  serverPid: number;
  compilerPid: number;
  state: CompilerStateType;
  mode: CompilerMode;
  iteration: number;
  url: string;
  env?: Record<string, string>;
};
