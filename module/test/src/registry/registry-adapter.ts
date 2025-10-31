import { RegistryAdapter, RegistryIndexClass } from '@travetto/registry';
import { asFull, Class, classConstruct, describeFunction, Runtime } from '@travetto/runtime';

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
      baseConfig.tests = [...(baseConfig.tests ?? []), ...cfg.tests];
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

export class SuiteRegistryAdapter implements RegistryAdapter<SuiteConfig, TestConfig> {
  indexCls: RegistryIndexClass<SuiteConfig, TestConfig>;
  #cls: Class;
  #config: SuiteConfig;
  #tests: Map<string | symbol, TestConfig> = new Map();

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
        tests: [],
        beforeAll: [],
        beforeEach: [],
        afterAll: [],
        afterEach: []
      });
    }
    combineClasses(this.#config, ...data);
    return this.#config;
  }

  registerField(): {} {
    throw new Error('Method not implemented.');
  }

  registerMethod(method: string | symbol, ...data: Partial<TestConfig>[]): TestConfig {
    const suite = this.register();
    if (!this.#tests.has(method)) {
      const lines = describeFunction(this.#cls)?.methods?.[method]?.lines;
      const testConfig = asFull<TestConfig>({
        class: this.#cls,
        tags: [],
        import: Runtime.getImport(this.#cls),
        lineStart: lines?.[0],
        lineEnd: lines?.[1],
        lineBodyStart: lines?.[2],
        methodName: method.toString()
      });
      this.#tests.set(method, testConfig);
      this.#config.tests!.push(testConfig);

    }
    combineMethods(suite, this.#tests.get(method)!, ...data);
    return this.#tests.get(method)!;
  }

  finalize(parent?: SuiteConfig): void {
    if (parent) {
      combineClasses(this.#config, parent);
    }

    this.#config.instance = classConstruct(this.#cls);
    this.#config.description ||= this.#config.classId;

    for (const test of this.#config.tests!) {
      test.sourceImport = this.#config.import;
      test.class = this.#cls;
      test.tags = [...test.tags ?? [], ...this.#config.tags ?? []];
    }
  }

  getClass(): SuiteConfig {
    return this.#config;
  }

  getField(): {} {
    throw new Error('Method not implemented.');
  }

  getMethod(method: string | symbol): TestConfig {
    return this.#tests.get(method)!;
  }
}