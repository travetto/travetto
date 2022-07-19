import { Suite, Test, BeforeEach, ShouldThrow } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';

import { DependencyRegistry } from '../src/registry';

@Suite('cycle', { skip: true })
class CycleTest {

  @BeforeEach()
  async each() {
    await import('./cycle/a');
    await import('./cycle/b');
    await RootRegistry.init();
  }

  @Test()
  @ShouldThrow('dependency')
  async tryCycle() {
    try {
      const { ABC } = await import('./cycle/a');
      const res = await DependencyRegistry.getInstance(ABC);
      console.log('Loaded dependency', { instance: res.constructor.name });
    } catch (err: unknown) {
      console.error('Failed to load dependency', { error: err });
      throw err;
    }
  }
}