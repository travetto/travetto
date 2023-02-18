import { ManifestModule } from '@travetto/manifest';
import ts from 'typescript';

export type CompileEmitError = Error | readonly ts.Diagnostic[];
export type CompileEmitter = (file: string, newProgram?: boolean) => Promise<CompileEmitError | undefined>;
export type CompileEmitEvent = { file: string, i: number, total: number, err?: CompileEmitError };
export type CompileStateEntry = { source: string, input: string, relativeInput: string, output?: string, module: ManifestModule };

export type CompileWatcherHandler = {
  create: (inputFile: string) => void;
  update: (inputFile: string) => void;
  delete: (outputFile: string) => void;
};
