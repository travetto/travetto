import type * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

import { TransformerManager } from '../src/manager';
import { SystemUtil } from '../src/util/system';

const NODE_VERSION = (process.env.TRV_NODE_VERSION ?? process.version)
  .replace(/^.*?(\d+).*?$/, (_, v) => v);
const TS_TARGET = ({
  12: 'ES2019',
  13: 'ES2019',
  14: 'ES2020',
  15: 'ESNext',
  16: 'ESNext'
} as const)[NODE_VERSION] ?? 'ESNext'; // Default if not found

type Module = {
  name: string;
  source: string;
  output: string;
  files: Record<string, [string, 'ts' | 'js'][] | undefined>
};

const OUT_DIR = `${SystemUtil.cwd}/.trv_out`;

export class Compiler {
  static run(bootLocation: string): Promise<void> {
    return new Compiler(bootLocation).run();
  }

  /**
   * Read the given tsconfig.json values for the project
   * @param path
   * @returns
   */
  static readTsConfigOptions(file: string): ts.CompilerOptions {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const tsv = require('typescript') as typeof ts;
    const { options } = tsv.parseJsonSourceFileConfigFileContent(
      tsv.readJsonConfigFile(file, tsv.sys.readFile), tsv.sys, SystemUtil.cwd
    );
    options.target = tsv.ScriptTarget[TS_TARGET];
    return options;
  }

  /**
   * Check transpilation errors
   * @param filename The name of the file
   * @param diagnostics The diagnostic errors
   */
  static checkTranspileErrors<T extends ts.Diagnostic>(filename: string, diagnostics: readonly T[]): void {
    if (diagnostics && diagnostics.length) {
      const errors: string[] = diagnostics.slice(0, 5).map(diag => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const message = (require('typescript') as typeof ts).flattenDiagnosticMessageText(diag.messageText, '\n');
        if (diag.file) {
          const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start!);
          return ` @ ${diag.file.fileName.replace(SystemUtil.cwd, '.')}(${line + 1}, ${character + 1}): ${message}`;
        } else {
          return ` ${message}`;
        }
      });

      if (diagnostics.length > 5) {
        errors.push(`${diagnostics.length - 5} more ...`);
      }
      throw new Error(`Transpiling ${filename.replace(SystemUtil.cwd, '.')} failed: \n${errors.join('\n')}`);
    }
  }


  #program: ts.Program | undefined;
  #transformerManager = new TransformerManager();
  #sourceFiles: string[];
  #transformers: string[];
  #transformerTsconfig: string;
  #sourceToOutput: (file: string) => string;
  #modules: Module[];

  constructor(
    bootLocation: string
  ) {
    this.#modules = JSON.parse(fs.readFileSync(`${bootLocation}/manifest.json`, 'utf8'));
    this.#sourceFiles = this.#modules.flatMap(
      x => [
        ...x.files.index ?? [],
        ...x.files.src ?? [],
        ...x.files.support ?? [],
        ...x.files.test ?? [],
        ...x.files.e2e ?? [],
      ]
        .filter(([, type]) => type === 'ts')
        .map(([f]) => `${x.source}/${f}`)
    );

    this.#transformers = this.#modules.flatMap(
      x => [
        ...x.files.support ?? []
      ]
        .filter(([f, type]) => type === 'ts' && f.startsWith('support/transformer.'))
        .map(([f]) => `${bootLocation}/${x.output}/${f.replace('.ts', '.js')}`)
    );

    this.#sourceToOutput = (file: string) => {
      for (const m of this.#modules) {
        if (file.startsWith(m.source)) {
          return file.replace(m.source, m.output);
        }
      }
      return file;
    };

    this.#transformerTsconfig = `${this.#modules.find(m => m.name === '@travetto/transformer')!.source}/tsconfig.trv.json`;
  }

  /**
   * Get loaded compiler options
   */
  #getCompilerOptions(): ts.CompilerOptions {
    const opts: Partial<ts.CompilerOptions> = {};
    const rootDir = opts.rootDir ?? SystemUtil.cwd;
    const projTsconfig = path.resolve(SystemUtil.cwd, 'tsconfig.json');
    // Fallback to base tsconfig if not found in local folder
    const config = fs.existsSync(projTsconfig) ? projTsconfig : this.#transformerTsconfig;
    console.log('Loading config', config);

    return {
      ...Compiler.readTsConfigOptions(config),
      rootDir,
      outDir: OUT_DIR,
      sourceRoot: rootDir,
      ...opts
    };
  }


  /**
   * Build typescript program
   */
  #getProgram(): ts.Program {
    const tsv = require('typescript') as typeof ts;
    const rootFiles = new Set(this.#sourceFiles);

    if (!this.#program) {
      console.debug('Loading program', { size: rootFiles.size });
      this.#program = tsv.createProgram({
        rootNames: [...rootFiles],
        options: this.#getCompilerOptions(),
        oldProgram: this.#program,
      });
      this.#transformerManager.build(this.#program!.getTypeChecker());
    }
    return this.#program!;
  }

  /**
   * Get program
   * @private
   */
  getProgram(): ts.Program {
    return this.#getProgram();
  }

  /**
   * Run the compiler
   */
  async run(): Promise<void> {
    const start = Date.now();

    await this.#transformerManager.init(this.#transformers.map(f => ({ file: f })));

    console.debug('Initialized', { duration: (Date.now() - start) / 1000 });

    for (const module of this.#modules) {
      if (module.files.rootFiles?.find(([f]) => f === 'package.json')) {
        fs.mkdirSync(`${OUT_DIR}/${module.output}`, { recursive: true });
        fs.writeFileSync(`${OUT_DIR}/${module.output}/package.json`,
          fs.readFileSync(`${module.source}/package.json`, 'utf8')
            .replaceAll('"index.ts"', '"index.js"')
          , 'utf8');
      }
      // Copy over all js files
      for (const files of Object.values(module.files)) {
        for (const [jsFile, ext] of files!) {
          if (ext === 'js') {
            const outJsFile = `${OUT_DIR}/${module.output}/${jsFile}`;
            console.log('Copying', outJsFile);
            fs.mkdirSync(path.dirname(outJsFile), { recursive: true });
            fs.copyFileSync(`${module.source}/${jsFile}`, outJsFile);
          }
        }
      }
    }

    // Compile with transformers
    const prog = this.getProgram();
    for (const file of this.#sourceFiles) {
      prog.emit(
        prog.getSourceFile(file),
        (targetFile: string, text, bom, onError) => {
          const output = this.#sourceToOutput(targetFile);
          const finalTarget = targetFile.startsWith(SystemUtil.cwd) ? `${SystemUtil.cwd}/${output}` : `${OUT_DIR}/${output}`;
          fs.mkdirSync(path.dirname(finalTarget), { recursive: true });
          fs.writeFileSync(finalTarget, text, 'utf8');
        },
        undefined,
        false,
        this.#transformerManager.getTransformers()
      );
    }
  }
}