import { RegistryAdapter, RegistryIndexClass } from '@travetto/registry';
import { AppError, asFull, Class, describeFunction, Runtime } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import { SuiteConfig } from '../model/suite';
import { TestConfig } from '../model/test';

function combineClasses(baseConfig: SuiteConfig, ...subConfig: Partial<SuiteConfig>[]): SuiteConfig {
  for (const cfg of subConfig) {
    if (cfg.beforeAll) {
      baseConfig.beforeAll = [...(baseConfig.beforeAll ?? []), ...cfg.beforeAll];
    }
    if (cfg.beforeEach) {
      baseConfig.beforeEach = [...(baseConfig.beforeEach ?? []), ...cfg.beforeEach];
    }
    if (cfg.afterAll) {
      baseConfig.afterAll = [...(baseConfig.afterAll ?? []), ...cfg.afterAll];
    }
    if (cfg.afterEach) {
      baseConfig.afterEach = [...(baseConfig.afterEach ?? []), ...cfg.afterEach];
    }
    if (cfg.tags) {
      baseConfig.tags = [...(baseConfig.tags ?? []), ...cfg.tags];
    }
    if (cfg.tests) {
      for (const [key, test] of Object.entries(cfg.tests ?? {})) {
        baseConfig.tests[key] = {
          ...test,
          sourceImport: Runtime.getImport(baseConfig.class),
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
  for (const cfg of subConfig) {
    Object.assign(baseConfig, cfg, {
      tags: [
        ...baseConfig.tags ?? [],
        ...cfg.tags ?? []
      ]
    });
  }
  return baseConfig;
}

export class SuiteRegistryAdapter implements RegistryAdapter<SuiteConfig> {
  indexCls: RegistryIndexClass<SuiteConfig>;
  #cls: Class;
  #config: SuiteConfig;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  register(...data: Partial<SuiteConfig>[]): SuiteConfig {
    if (!this.#config) {
      const lines = describeFunction(this.#cls)?.lines;
      this.#config = asFull<SuiteConfig>({
        class: this.#cls,
        classId: this.#cls.Ⲑid,
        tags: [],
        import: Runtime.getImport(this.#cls),
        lineStart: lines?.[0],
        lineEnd: lines?.[1],
        tests: {},
        beforeAll: [],
        beforeEach: [],
        afterAll: [],
        afterEach: []
      });
    }
    combineClasses(this.#config, ...data);
    return this.#config;
  }

  registerTest(method: string | symbol, ...data: Partial<TestConfig>[]): TestConfig {
    const suite = this.register();

    if (!(method in this.#config.tests)) {
      const lines = describeFunction(this.#cls)?.methods?.[method]?.lines;
      const config = asFull<TestConfig>({
        class: this.#cls,
        tags: [],
        import: Runtime.getImport(this.#cls),
        lineStart: lines?.[0],
        lineEnd: lines?.[1],
        lineBodyStart: lines?.[2],
        methodName: method.toString(),
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
      test.description ||= SchemaRegistryIndex.getMethodConfig(this.#cls, test.methodName).description;
    }
  }

  get(): SuiteConfig {
    return this.#config;
  }

  getMethod(method: string | symbol): TestConfig {
    const test = this.#config.tests[method];
    if (!test) {
      throw new AppError(`Test not registered: ${String(method)} on ${this.#cls.name}`);
    }
    return test;
  }
}