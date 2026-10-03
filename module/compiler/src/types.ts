import type { ChangeEventType, ManifestModule } from '@travetto/manifest';

export type CompilerStateType =
  | 'startup'
  | 'init'
  | 'compile-start'
  | 'compile-end'
  | 'compile-failed'
  | 'watch-start'
  | 'watch-end'
  | 'reset'
  | 'closed';

export type CompilerLogPhase = 'failure' | 'error' | 'reset';
export type CompilerLogLevel = 'info' | 'debug' | 'warn' | 'error';

export type CompilerDiagnosticItem = {
  line: number;
  column: number;
  message: string;
};

export type CompileEmitEvent = {
  file: string;
  sourceFile: string;
  i: number;
  total: number;
  duration: number;
};
export type CompileStateEntry = {
  sourceFile: string;
  tscOutputFile: string;
  outputFile?: string;
  module: ManifestModule;
  import: string;
  moduleFile: string;
};
export type CompilerWatchEvent = { action: ChangeEventType; file: string; entry: CompileStateEntry; moduleFile: string };

type Scoped<T extends {}> = T & { workspace?: string };
export type CompilerChangeEvent = Scoped<{
  file: string;
  action: ChangeEventType;
  output: string;
  module: string;
  import: string;
  time: number;
}>;
export type CompilerLogEvent = Scoped<{
  level: CompilerLogLevel;
  message: string;
  time?: number;
  args?: unknown[];
  scope?: string;
  phase?: CompilerLogPhase;
}>;
export type CompilerProgressEvent = Scoped<{ idx: number; total: number; message: string; operation: 'compile'; complete?: boolean }>;
export type CompilerStateEvent = Scoped<{ state: CompilerStateType; extra?: Record<string, unknown> }>;
export type FileChangeEvent = Scoped<{ files: { file: string; action: ChangeEventType }[]; time: number }>;
export type CompilerAllEvent = Scoped<{}>;

export type CompilerEvent =
  | { type: 'file'; payload: FileChangeEvent }
  | { type: 'change'; payload: CompilerChangeEvent }
  | { type: 'log'; payload: CompilerLogEvent }
  | { type: 'progress'; payload: CompilerProgressEvent }
  | { type: 'state'; payload: CompilerStateEvent }
  | { type: 'all'; payload: CompilerAllEvent };

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
  messages?: Partial<Record<CompilerLogPhase, CompilerLogEvent[]>>;
};

export class CompilerReset extends Error {}
