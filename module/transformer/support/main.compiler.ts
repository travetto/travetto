#!/usr/bin/env node
import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

import { TransformerManager } from '../src/manager';

const CWD = process.cwd();


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
  files: Record<string, [string, 'ts' | 'js'][] | undefined>;
};

export class Compiler {

  #program: ts.Program | undefined;
  #transformerManager = new TransformerManager();
  #sourceFiles: string[];
  #transformers: string[];
  #transformerTsconfig: string;
  #sourceToOutput: (file: string) => string;
  #modules: Module[];
  #outDir: string;
  #bootLocation: string;

  constructor(
    outDir: string,
    bootLocation?: string,
  ) {
    this.#outDir = path.resolve(outDir).replaceAll('\\', '/');
    this.#bootLocation = path.resolve(CWD, bootLocation ?? __filename.split('node_modules')[0]).replaceAll('\\', '/');

    this.#modules = JSON.parse(fs.readFileSync(`${this.#bootLocation}/manifest.json`, 'utf8'));
    this.#sourceFiles = this.#modules.flatMap(
      x => [
        ...x.files.index ?? [],
        ...x.files.src ?? [],
        ...x.files.support ?? [],
        ...x.files.test ?? [],
      ]
        .filter(([, type]) => type === 'ts')
        .map(([f]) => `${x.source}/${f}`)
    );

    this.#transformers = this.#modules.flatMap(
      x => (x.files.support ?? [])
        .filter(([f, type]) => type === 'ts' && f.startsWith('support/transformer.'))
        .map(([f]) => `${this.#bootLocation}/${x.output}/${f.replace(/[.][tj]s$/, '')}`)
    );

    this.#sourceToOutput = (file: string): string => {
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
   * Read the given tsconfig.json values for the project
   * @param path
   * @returns
   */
  readTsConfigOptions(file: string): ts.CompilerOptions {
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
  #getCompilerOptions(): ts.CompilerOptions {
    const opts: Partial<ts.CompilerOptions> = {};
    const rootDir = opts.rootDir ?? CWD;
    const projTsconfig = path.resolve('tsconfig.json');
    // Fallback to base tsconfig if not found in local folder
    const config = fs.existsSync(projTsconfig) ? projTsconfig : this.#transformerTsconfig;
    console.log('Loading config', config);

    return {
      ...this.readTsConfigOptions(config),
      rootDir,
      outDir: this.#outDir,
      sourceRoot: rootDir,
      ...opts
    };
  }


  /**
   * Build typescript program
   */
  #getProgram(): ts.Program {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const rootFiles = new Set(this.#sourceFiles);

    if (!this.#program) {
      console.debug('Loading program', { size: rootFiles.size });
      this.#program = ts.createProgram({
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
        fs.mkdirSync(`${this.#outDir}/${module.output}`, { recursive: true });
        fs.writeFileSync(`${this.#outDir}/${module.output}/package.json`,
          fs.readFileSync(`${module.source}/package.json`, 'utf8')
            .replaceAll('"index.ts"', '"index.js"')
          , 'utf8');
      }
      // Copy over all js files
      for (const files of Object.values(module.files)) {
        for (const [jsFile, ext] of files!) {
          if (ext === 'js') {
            const outJsFile = `${this.#outDir}/${module.output}/${jsFile}`;
            console.log('Copying', outJsFile);
            fs.mkdirSync(path.dirname(outJsFile), { recursive: true });
            fs.copyFileSync(`${module.source}/${jsFile}`, outJsFile);
          }
        }
      }
    }

    // Write manifest
    fs.writeFileSync(`${this.#outDir}/manifest.json`, JSON.stringify(this.#modules));

    // Compile with transformers
    const prog = this.getProgram();
    for (const file of this.#sourceFiles) {
      const result = prog.emit(
        prog.getSourceFile(file),
        (targetFile, text) => {
          const output = this.#sourceToOutput(targetFile);
          const finalTarget = targetFile.startsWith(CWD) ? `${CWD}/${output}` : `${this.#outDir}/${output}`;
          fs.mkdirSync(path.dirname(finalTarget), { recursive: true });
          fs.writeFileSync(finalTarget, text, 'utf8');
        },
        undefined,
        false,
        this.#transformerManager.getTransformers()
      );
      this.checkTranspileErrors(file, result.diagnostics);
    }
  }
}

async function main(outDir = '.trv_out'): Promise<void> {
  return new Compiler(outDir).run();
}

if (require.main === module) {
  main(...process.argv.slice(2));
}