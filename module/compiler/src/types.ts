import type ts from 'typescript';

import type { WatchEvent, ManifestModule } from '@travetto/manifest';

export type CompileEmitError = Error | readonly ts.Diagnostic[];
export type CompileEmitter = (file: string, newProgram?: boolean) => Promise<CompileEmitError | undefined>;
export type CompileEmitEvent = { file: string, i: number, total: number, err?: CompileEmitError };
export type CompileStateEntry = { source: string, input: string, relativeInput: string, output?: string, module: ManifestModule };

export type CompileWatcherHandler = {
  create: (inputFile: string) => void;
  update: (inputFile: string) => void;
  delete: (outputFile: string) => void;
};

export type CompileWatchEvent = WatchEvent & { entry: CompileStateEntry };
