import type ts from 'typescript';

import type { ChangeEventType, ManifestModule } from '@travetto/manifest';

export type CompilerStateType = 'startup' | 'init' | 'compile-start' | 'compile-end' | 'watch-start' | 'watch-end' | 'reset' | 'closed';
export type CompilerLogLevel = 'info' | 'debug' | 'warn' | 'error';

export type CompileEmitError = Error | readonly ts.Diagnostic[];
export type CompileEmitter = (file: string, newProgram?: boolean) => Promise<CompileEmitError | undefined>;
export type CompileEmitEvent = { file: string, i: number, total: number, error?: CompileEmitError, duration: number };
export type CompileStateEntry = { sourceFile: string, tscOutputFile: string, outputFile?: string, module: ManifestModule, import: string, moduleFile: string };
export type CompilerWatchEvent = { action: ChangeEventType, file: string, entry: CompileStateEntry, moduleFile: string };

export type CompilerChangeEvent = { file: string, action: ChangeEventType, output: string, module: string, import: string, time: number };
export type CompilerLogEvent = { level: CompilerLogLevel, message: string, time?: number, args?: unknown[], scope?: string };
export type CompilerProgressEvent = { idx: number, total: number, message: string, operation: 'compile', complete?: boolean };
export type CompilerStateEvent = { state: CompilerStateType, extra?: Record<string, unknown> };
export type FileChangeEvent = { files: { file: string, action: ChangeEventType }[], time: number };

export type CompilerEvent =
  { type: 'file', payload: FileChangeEvent } |
  { type: 'change', payload: CompilerChangeEvent } |
  { type: 'log', payload: CompilerLogEvent } |
  { type: 'progress', payload: CompilerProgressEvent } |
  { type: 'state', payload: CompilerStateEvent } |
  { type: 'all', payload: unknown };

export type CompilerEventType = CompilerEvent['type'];
export type CompilerEventPayload<V> = (CompilerEvent & { type: V })['payload'];

export type CompilerServerInfo = {
  path: string;
  serverProcessId: number;
  compilerProcessId: number;
  state: CompilerStateType;
  watching: boolean;
  iteration: number;
  url: string;
  env?: Record<string, string>;
};

export class CompilerReset extends Error { }
