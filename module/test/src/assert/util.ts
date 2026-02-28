import util from 'node:util';
import path from 'node:path';

import { asFull, type Class, JSONUtil, hasFunction, Runtime, RuntimeIndex } from '@travetto/runtime';

import type { Assertion, TestResult } from '../model/test.ts';
import type { SuiteConfig, SuiteFailure, SuiteResult } from '../model/suite.ts';

const isCleanable = hasFunction<{ toClean(): unknown }>('toClean');

/**
 * Assertion utilities
 */
export class AssertUtil {
  /**
   * Clean a value for displaying in the output
   */
  static cleanValue(value: unknown): unknown {
    switch (typeof value) {
      case 'number': case 'boolean': case 'bigint': case 'string': case 'undefined': return value;
      case 'object': {
        if (isCleanable(value)) {
          return value.toClean();
        } else if (value === null || value.constructor === Object || Array.isArray(value) || value instanceof Date) {
          return JSONUtil.toUTF8(value);
        }
        break;
      }
      case 'function': {
        if (value.Ⲑid || !value.constructor) {
          return value.name;
        }
        break;
      }
    }
    return util.inspect(value, false, 1).replace(/\n/g, ' ');
  }

  /**
   * Determine file location for a given error and the stack trace
   */
  static getPositionOfError(error: Error, importLocation: string): { import: string, line: number } {
    const workingDirectory = Runtime.mainSourcePath;
    const lines = (error.stack ?? new Error().stack!)
      .replace(/[\\/]/g, '/')
      .split('\n')
      // Exclude node_modules, target self
      .filter(lineText => lineText.includes(workingDirectory) && (!lineText.includes('node_modules') || lineText.includes('/support/')));

    const filename = RuntimeIndex.getFromImport(importLocation)?.sourceFile!;

    let best = lines.filter(lineText => lineText.includes(filename))[0];

    if (!best) {
      [best] = lines.filter(lineText => lineText.includes(`${workingDirectory}/test`));
    }

    if (!best) {
      return { import: importLocation, line: 1 };
    }

    const location = best.trim().split(/\s+/g).slice(1).pop()!;
    if (!location) {
      return { import: importLocation, line: 1 };
    }

    const [file, lineNumber] = location
      .replace(/[()]/g, '')
      .replace(/^[A-Za-z]:/, '')
      .split(':');

    let line = parseInt(lineNumber, 10);
    if (Number.isNaN(line)) {
      line = -1;
    }

    const outFileParts = file.split(workingDirectory.replace(/^[A-Za-z]:/, ''));

    const outFile = outFileParts.length > 1 ? outFileParts[1].replace(/^[\/]/, '') : filename;

    const result = { import: RuntimeIndex.getFromSource(outFile)?.import!, line };

    return result;
  }

  /**
   * Generate a suite error given a suite config, and an error
   */
  static generateSuiteTestFailure(config: { suite: SuiteConfig, methodName: string, error: Error, importLocation: string }): TestResult {
    const { suite, methodName, error, importLocation } = config;
    const { import: imp, ...rest } = this.getPositionOfError(error, importLocation);
    let line = rest.line;

    if (line === 1 && suite.lineStart) {
      line = suite.lineStart;
    }

    const msg = error.message.split(/\n/)[0];

    const core = { import: imp, classId: suite.classId, methodName, sourceHash: suite.sourceHash };
    const coreAll = { ...core, description: msg, lineStart: line, lineEnd: line, lineBodyStart: line };

    const assert: Assertion = {
      ...core,
      operator: 'throw', error, line, message: msg, text: methodName
    };
    const testResult: TestResult = {
      ...coreAll,
      status: 'failed', error, duration: 0, durationTotal: 0, assertions: [assert], output: []
    };

    return testResult;
  }

  /**
   * Generate suite failure
   */
  static generateSuiteFailure(suite: SuiteConfig, error: Error): SuiteFailure {
    const testResults: TestResult[] = [];
    for (const test of Object.values(suite.tests)) {
      testResults.push(this.generateSuiteTestFailure({
        suite,
        methodName: test.methodName,
        error: error.cause instanceof Error ? error.cause : error,
        importLocation: 'import' in error && typeof error.import === 'string' ? error.import : suite.import
      }));
    }
    return { suite, testResults };
  }

  /**
   * Define import failure as a SuiteFailure object
   */
  static gernerateImportFailure(importLocation: string, error: Error): SuiteFailure {
    const name = path.basename(importLocation);
    const classId = `${RuntimeIndex.getFromImport(importLocation)?.id}#${name}`;
    const suite = asFull<SuiteConfig & SuiteResult>({
      class: asFull<Class>({ name }), classId, duration: 0, lineStart: 1, lineEnd: 1, import: importLocation
    });
    error.message = error.message.replaceAll(Runtime.mainSourcePath, '.');
    return { suite, testResults: [this.generateSuiteTestFailure({ suite, methodName: 'require', error, importLocation: suite.import })] };
  }
}