#!/usr/bin/env node
import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs/promises';

import { TransformerManager } from '../src/manager';

import { TS_TARGET } from './bin/config';
import { WorkspaceManager } from './bin/workspace';

const CWD = process.cwd();

export class Compiler {

  #program: ts.Program | undefined;
  #transformerManager = new TransformerManager();
  #sourceFiles: string[];
  #transformers: string[];
  #transformerTsconfig: string;

  #mgr: WorkspaceManager;

  constructor(
    mgr: WorkspaceManager
  ) {
    this.#mgr = mgr;
    this.#sourceFiles = this.#mgr.modules.flatMap(
      x => [
        ...x.files.index ?? [],
        ...x.files.src ?? [],
        ...x.files.support ?? [],
        ...x.files.test ?? [],
      ]
        .filter(([, type]) => type === 'ts')
        .map(([f]) => `${x.source}/${f}`)
    );

    this.#transformers = this.#mgr.modules.flatMap(
      x => (x.files.support ?? [])
        .filter(([f, type]) => type === 'ts' && f.startsWith('support/transformer.'))
        .map(([f]) => this.#mgr.resolveInBoot(x, f.replace(/[.][tj]s$/, ''))));

    this.#transformerTsconfig = `${this.#mgr.modules.find(m => m.name === '@travetto/transformer')!.source}/tsconfig.trv.json`;
  }

  /**
   * Read the given tsconfig.json values for the project
   * @param path
   * @returns
   */
  async readTsConfigOptions(file: string): Promise<ts.CompilerOptions> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const { options } = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(file, ts.sys.readFile), ts.sys, CWD
    );
    options.target = ts.ScriptTarget[TS_TARGET];
    return options;
  }

  /**
   * Check transpilation errors
   * @param filename The name of the file
   * @param diagnostics The diagnostic errors
   */
  checkTranspileErrors(filename: string, diagnostics: readonly ts.Diagnostic[]): void {
    if (diagnostics && diagnostics.length) {
      const errors: string[] = diagnostics.slice(0, 5).map(diag => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
        if (diag.file) {
          const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start!);
          return ` @ ${diag.file.fileName.replace(CWD, '.')}(${line + 1}, ${character + 1}): ${message}`;
        } else {
          return ` ${message}`;
        }
      });

      if (diagnostics.length > 5) {
        errors.push(`${diagnostics.length - 5} more ...`);
      }
      throw new Error(`Transpiling ${filename.replace(CWD, '.')} failed: \n${errors.join('\n')}`);
    }
  }


  /**
   * Get loaded compiler options
   */
  async #getCompilerOptions(): Promise<ts.CompilerOptions> {
    const opts: Partial<ts.CompilerOptions> = {};
    const rootDir = opts.rootDir ?? CWD;
    const projTsconfig = path.resolve('tsconfig.json');
    // Fallback to base tsconfig if not found in local folder
    const config = (await fs.stat(projTsconfig).then(x => true, x => false)) ? projTsconfig : this.#transformerTsconfig;
    console.log('Loading config', config);

    return {
      ...(await this.readTsConfigOptions(config)),
      rootDir,
      outDir: this.#mgr.outDir,
      sourceRoot: rootDir,
      ...opts
    };
  }


  /**
   * Build typescript program
   */
  async getProgram(): Promise<ts.Program> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const rootFiles = new Set(this.#sourceFiles);

    if (!this.#program) {
      console.debug('Loading program', { size: rootFiles.size });
      this.#program = ts.createProgram({
        rootNames: [...rootFiles],
        options: await this.#getCompilerOptions(),
        oldProgram: this.#program,
      });
      this.#transformerManager.build(this.#program!.getTypeChecker());
    }
    return this.#program!;
  }

  /**
   * Run the compiler
   */
  async run(): Promise<void> {
    const start = Date.now();

    await this.#mgr.init();

    await this.#transformerManager.init(this.#transformers.map(f => ({ file: f })));

    console.debug('Initialized', { duration: (Date.now() - start) / 1000 });

    // Compile with transformers
    const prog = await this.getProgram();
    for (const file of this.#sourceFiles) {
      const result = prog.emit(
        prog.getSourceFile(file),
        (targetFile, text) => this.#mgr.writeSourceOutput(targetFile, text),
        undefined,
        false,
        this.#transformerManager.getTransformers()
      );
      this.checkTranspileErrors(file, result.diagnostics);
    }
  }
}

async function main(outDir = '.trv_out'): Promise<void> {
  return new Compiler(new WorkspaceManager(outDir)).run();
}

if (require.main === module) {
  main(...process.argv.slice(2));
}