import ts from 'typescript';
import fs from 'fs/promises';
import path from 'path';

import { ManifestState } from '@travetto/manifest';
import { GlobalTerminal } from '@travetto/terminal';

import { CompilerUtil } from './util';
import { CompilerState } from './state';

export type TransformerProvider = {
  init(checker: ts.TypeChecker): void;
  get(): ts.CustomTransformers | undefined;
};

type EmitError = Error | readonly ts.Diagnostic[];
type Emitter = (file: string, newProgram?: boolean) => EmitError | undefined;
type EmitEvent = { file: string, i: number, total: number, err?: EmitError };

/**
 * Compilation support
 */
export class Compiler {

  #bootTsconfig: string;
  #state: CompilerState;
  #transformers: string[];

  init(manifestState: ManifestState): this {
    this.#state = new CompilerState(manifestState);
    this.#bootTsconfig = this.#state.resolveModuleFile('@travetto/compiler', 'tsconfig.trv.json');

    this.#transformers = this.state.modules.flatMap(
      x => (x.files.support ?? [])
        .filter(([f, type]) => type === 'ts' && f.startsWith('support/transformer.'))
        .map(([f]) =>
          path.resolve(
            this.#state.manifest.workspacePath,
            this.#state.manifest.compilerFolder,
            x.output,
            f.replace(/[.][tj]s$/, '.js')
          )
        )
    );

    return this;
  }

  get state(): CompilerState {
    return this.#state;
  }

  /**
   * Watches local modules
   */
  async #watchLocalModules(emit: Emitter): Promise<() => Promise<void>> {
    const folders = this.state.modules.filter(x => x.local).map(x => x.source);
    const emitWithError = (file: string): void => {
      const err = emit(file, true);
      if (err) {
        console.error(CompilerUtil.buildTranspileError(file, err));
      }
    };
    const watcher = this.state.getWatcher({
      create: (inputFile) => emitWithError(inputFile),
      update: (inputFile) => emitWithError(inputFile),
      delete: (outputFile) => fs.unlink(outputFile)
    });
    return CompilerUtil.fileWatcher(folders, watcher);
  }

  async createTransformerProvider(): Promise<TransformerProvider> {
    const { TransformerManager } = await import('@travetto/transformer');
    return TransformerManager.create(this.#transformers, this.state.manifest);
  }

  async writeRawFile(file: string, contents: string, mode?: string): Promise<void> {
    const outFile = path.resolve(
      this.#state.manifest.workspacePath,
      this.#state.manifest.outputFolder,
      file
    );
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.writeFile(outFile, contents, { encoding: 'utf8', mode });
  }

  async outputInit(): Promise<void> {
    // Write manifest
    await this.writeRawFile(this.#state.manifest.manifestFile, JSON.stringify(this.state.manifest));
    // TODO: This needs to be isolated, just like in the bootstrap
    await this.writeRawFile('trv', '#!/bin/sh\nnode node_modules/@travetto/cli/support/main.cli.js $@\n', '755');
    await this.writeRawFile('trv.cmd', 'node node_modules/@travetto/cli/support/main.cli.js %*\n', '755');
  }

  /**
   * Compile in a single pass, only emitting dirty files
   */
  async getCompiler(): Promise<Emitter> {
    let program: ts.Program;

    const transformers = await this.createTransformerProvider();
    const options = await CompilerUtil.getCompilerOptions(
      path.resolve(
        this.#state.manifest.workspacePath,
        this.#state.manifest.outputFolder,
      ),
      this.#bootTsconfig,
      this.#state.manifest.workspacePath
    );
    const host = this.state.getCompilerHost(options);

    const emit = (file: string, needsNewProgram = program === undefined): EmitError | undefined => {
      if (needsNewProgram) {
        program = ts.createProgram({ rootNames: this.#state.getAllFiles(), host, options, oldProgram: program });
        transformers.init(program.getTypeChecker());
      }
      try {
        const result = program.emit(
          program.getSourceFile(file)!, host.writeFile, undefined, false, transformers.get()
        );

        if (result.diagnostics?.length) {
          return result.diagnostics;
        }
      } catch (err) {
        if (err instanceof Error) {
          return err;
        } else {
          throw err;
        }
      }
    };

    return emit;
  }

  /**
   * Emit all files as a stream
   */
  async * emit(files: string[], emitter: Emitter): AsyncIterable<EmitEvent> {
    let i = 0;
    const manifest = this.#state.manifest;
    for (const file of files) {
      const err = emitter(file);
      const outputFile = file
        .replace(/[.]ts$/, '.js')
        .replace(manifest.compilerFolder, manifest.outputFolder);
      yield { file: outputFile, i: i += 1, err, total: files.length };
    }
  }

  /**
   * Run the compiler
   */
  async run(watch?: boolean): Promise<void> {
    await this.outputInit();
    const emitter = await this.getCompiler();
    let failed = false;

    const resolveEmittedFile = ({ file, total, i, err }: EmitEvent): { idx: number, total: number, status: string } => {
      if (err) {
        failed = true;
        console.error(CompilerUtil.buildTranspileError(file, err));
      }
      return { idx: i, total, status: file };
    };

    await GlobalTerminal.trackProgress(
      'Compiling',
      this.emit(this.state.getDirtyFiles(), emitter),
      resolveEmittedFile,
      { position: 'bottom' }
    );

    if (failed) {
      process.exit(-1);
    }

    if (watch) {
      await this.#watchLocalModules(emitter);
      await new Promise(r => setTimeout(r, 1000 * 60 * 60 * 24));
    }
  }
}