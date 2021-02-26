import { Class } from '@travetto/base';
import { RootRegistry } from '@travetto/registry';
import { BeforeAll, Suite } from '@travetto/test';
import { DependencyRegistry } from '../src/registry';

@Suite()
export abstract class BaseInjectableTest {
  @BeforeAll()
  async inject() {
    await RootRegistry.init();
    const config = await DependencyRegistry.get(this.constructor as Class);
    for (const [key, dep] of Object.entries(config.dependencies.fields)) {
      (this as { [key: string]: any })[key] = await DependencyRegistry.getInstance(dep.target, dep.qualifier);
    }
  }
}