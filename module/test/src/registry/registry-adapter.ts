import type { RegistryAdapter } from '@travetto/registry';
import { RuntimeError, asFull, type Class, describeFunction, Runtime, safeAssign } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import type { SuiteConfig } from '../model/suite.ts';
import type { TestConfig } from '../model/test.ts';

function combineClasses(baseConfig: SuiteConfig, ...subConfig: Partial<SuiteConfig>[]): SuiteConfig {
  for (const config of subConfig) {
    if (config.tags) {
      baseConfig.tags = [...baseConfig.tags ?? [], ...config.tags];
    }
    baseConfig.skip = config.skip ?? baseConfig.skip;

    if (config.phaseHandlers) {
      baseConfig.phaseHandlers = [...(baseConfig.phaseHandlers ?? []), ...config.phaseHandlers];
    }

    if (config.tests) {
      for (const [key, test] of Object.entries(config.tests ?? {})) {
        baseConfig.tests[key] = {
          ...test,
          sourceImport: test.import,
          class: baseConfig.class,
          classId: baseConfig.classId,
          import: baseConfig.import,
        };
      }
    }
  }
  return baseConfig;
}

function combineMethods(suite: SuiteConfig, baseConfig: TestConfig, ...subConfig: Partial<TestConfig>[]): TestConfig {
  baseConfig.classId = suite.classId;
  baseConfig.import = suite.import;
  for (const config of subConfig) {
    safeAssign(baseConfig, config, {
      tags: [
        ...baseConfig.tags ?? [],
        ...config.tags ?? []
      ]
    });
  }
  return baseConfig;
}

export class SuiteRegistryAdapter implements RegistryAdapter<SuiteConfig> {
  #cls: Class;
  #config: SuiteConfig;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  register(...data: Partial<SuiteConfig>[]): SuiteConfig {
    if (!this.#config) {
      const { lines, hash } = describeFunction(this.#cls) ?? {};
      this.#config = asFull<SuiteConfig>({
        class: this.#cls,
        classId: this.#cls.Ⲑid,
        tags: [],
        skip: false,
        import: Runtime.getImport(this.#cls),
        lineStart: lines?.[0],
        lineEnd: lines?.[1],
        sourceHash: hash,
        tests: {},
        phaseHandlers: [],
      });
    }
    combineClasses(this.#config, ...data);
    return this.#config;
  }

  registerTest(method: string, ...data: Partial<TestConfig>[]): TestConfig {
    const suite = this.register();

    if (!(method in this.#config.tests)) {
      const { lines, hash } = describeFunction(this.#cls)?.methods?.[method] ?? {};
      const config = asFull<TestConfig>({
        class: this.#cls,
        tags: [],
        skip: false,
        import: Runtime.getImport(this.#cls),
        lineStart: lines?.[0],
        lineEnd: lines?.[1],
        lineBodyStart: lines?.[2],
        methodName: method,
        sourceHash: hash,
      });
      this.#config.tests[method] = config;
    }

    const result = this.#config.tests[method];
    combineMethods(suite, result, ...data);
    return result;
  }

  finalize(parent?: SuiteConfig): void {
    if (parent) {
      combineClasses(this.#config, parent);
    }

    for (const test of Object.values(this.#config.tests)) {
      test.tags = [...test.tags ?? [], ...this.#config.tags ?? []];
      test.description ||= SchemaRegistryIndex.get(this.#cls).getMethod(test.methodName).description;
    }
  }

  get(): SuiteConfig {
    return this.#config;
  }

  getMethod(method: string): TestConfig {
    const test = this.#config.tests[method];
    if (!test) {
      throw new RuntimeError(`Test not registered: ${String(method)} on ${this.#cls.name}`);
    }
    return test;
  }
}