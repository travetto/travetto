import type ts from 'typescript';

import type { ChangeEventType, ManifestModule } from '@travetto/manifest';

export type CompileEmitError = Error | readonly ts.Diagnostic[];
export type CompileEmitter = (file: string, newProgram?: boolean) => Promise<CompileEmitError | undefined>;
export type CompileEmitEvent = { file: string, i: number, total: number, error?: CompileEmitError, duration: number };
export type CompileStateEntry = { sourceFile: string, tscOutputFile: string, outputFile?: string, module: ManifestModule, import: string, moduleFile: string };
export type CompilerWatchEvent = { action: ChangeEventType, file: string, entry: CompileStateEntry };
export class CompilerReset extends Error { }
