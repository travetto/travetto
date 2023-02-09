import util from 'util';
import { install } from 'source-map-support';
import ts from 'typescript';
import fs from 'fs/promises';

import { GlobalTerminal, TerminalProgressEvent } from '@travetto/terminal';
import { RootIndex, watchFolders } from '@travetto/manifest';
import { TransformerManager } from '@travetto/transformer';

import { CompilerUtil } from './util';
import { CompilerState } from './state';
import type { CompilerLogEvent } from '../support/transpile';

export type TransformerProvider = {
  init(checker: ts.TypeChecker): void;
  get(): ts.CustomTransformers | undefined;
};

type EmitError = Error | readonly ts.Diagnostic[];
type Emitter = (file: string, newProgram?: boolean) => Promise<EmitError | undefined>;
type EmitEvent = { file: string, i: number, total: number, err?: EmitError };

function log(level: 'info' | 'debug', message: string, ...args: unknown[]): void {
  if (process.send) {
    const ev: CompilerLogEvent = [level, util.format(message, ...args)];
    process.send(ev);
  } else {
    // eslint-disable-next-line no-console
    console[level](message, ...args);
  }
}

const debug = log.bind(null, 'debug');
const info = log.bind(null, 'info');

/**
 * Compilation support
 */
export class Compiler {

  /**
   * Run compiler as a main entry point
   */
  static async main(): Promise<void> {
    const [dirty, watch] = process.argv.slice(2);
    install();
    const dirtyFiles = (await fs.readFile(dirty, 'utf8')).split(/\n/).filter(x => !!x);
    return new Compiler(dirtyFiles).run(watch === 'true');
  }

  #state: CompilerState;
  #dirtyFiles: string[];

  constructor(dirtyFiles: string[]) {
    this.#state = new CompilerState(RootIndex.manifest);
    this.#dirtyFiles = dirtyFiles[0] === '*' ?
      this.#state.getAllFiles() :
      dirtyFiles.map(f => this.#state.resolveInput(f));
  }

  get state(): CompilerState {
    return this.#state;
  }

  /**
   * Watches local modules
   */
  async #watchLocalModules(emit: Emitter): Promise<() => Promise<void>> {
    const emitWithError = async (file: string): Promise<void> => {
      const err = await emit(file, true);
      if (err) {
        info('Compilation Error', CompilerUtil.buildTranspileError(file, err));
      } else {
        info(`Compiled ${file.split('node_modules/')[1]}`);
      }
    };
    const watcher = this.state.getWatcher({
      create: emitWithError,
      update: emitWithError,
      delete: (outputFile) => fs.unlink(outputFile).catch(() => { })
    });
    return watchFolders(RootIndex.getLocalInputFolders(), watcher, {
      filter: ev => ev.file.endsWith('.ts') || ev.file.endsWith('.js'),
      ignore: ['node_modules']
    });
  }

  async createTransformerProvider(): Promise<TransformerProvider> {
    return TransformerManager.create(this.state.transformers);
  }

  /**
   * Compile in a single pass, only emitting dirty files
   */
  async getCompiler(): Promise<Emitter> {
    let program: ts.Program;

    const transformers = await this.createTransformerProvider();
    const options = await this.state.getCompilerOptions();
    const host = this.state.getCompilerHost(options);

    const emit = async (file: string, needsNewProgram = program === undefined): Promise<EmitError | undefined> => {
      try {
        if (needsNewProgram) {
          program = ts.createProgram({ rootNames: this.#state.getAllFiles(), host, options, oldProgram: program });
          transformers.init(program.getTypeChecker());
        }
        if (file.endsWith('.json')) {
          host.writeFile(file, host.readFile(file)!, false);
        } else if (file.endsWith('.js')) {
          host.writeFile(file, ts.transpile(host.readFile(file)!, options), false);
        } else {
          const result = program.emit(
            program.getSourceFile(file)!, host.writeFile, undefined, false, transformers.get()
          );

          if (result.diagnostics?.length) {
            return result.diagnostics;
          }
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
    for (const file of files) {
      const err = await emitter(file);
      const imp = file.replace(/.*node_modules\//, '');
      yield { file: imp, i: i += 1, err, total: files.length };
    }
    debug(`Compiled ${i} files`);
  }

  /**
   * Run the compiler
   */
  async run(watch?: boolean): Promise<void> {
    debug('Compilation started');

    const emitter = await this.getCompiler();
    let failed = false;

    debug('Compiler loaded');

    const resolveEmittedFile = ({ file, total, i, err }: EmitEvent): TerminalProgressEvent => {
      if (err) {
        failed = true;
        console.error(CompilerUtil.buildTranspileError(file, err));
      }
      return { idx: i, total, text: `Compiling [%idx/%total] -- ${file}` };
    };

    if (this.#dirtyFiles.length) {
      await GlobalTerminal.trackProgress(this.emit(this.#dirtyFiles, emitter), resolveEmittedFile, { position: 'bottom' });
      if (failed) {
        debug('Compilation failed');
        process.exit(1);
      } else {
        debug('Compilation succeeded');
      }
    }

    if (watch) {
      if (!this.#dirtyFiles.length) {
        const resolved = this.state.resolveInput(RootIndex.getModule('@travetto/manifest')!.files.src[0].sourceFile);
        await emitter(resolved, true);
      }
      info('Watch is ready');
      await this.#watchLocalModules(emitter);
      await new Promise(r => setTimeout(r, 1000 * 60 * 60 * 24));
    }
  }
}