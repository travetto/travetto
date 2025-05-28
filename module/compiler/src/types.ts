import type ts from 'typescript';

import type { ManifestModule } from '@travetto/manifest';

export type CompileEmitError = Error | readonly ts.Diagnostic[];
export type CompileEmitter = (file: string, newProgram?: boolean) => Promise<CompileEmitError | undefined>;
export type CompileEmitEvent = { file: string, i: number, total: number, err?: CompileEmitError, duration: number };
export type CompileStateEntry = { sourceFile: string, tscOutputFile: string, outputFile?: string, module: ManifestModule };
export type CompilerWatchEvent = { action: 'create' | 'update' | 'delete', file: string, entry: CompileStateEntry };
export class CompilerReset extends Error { }
