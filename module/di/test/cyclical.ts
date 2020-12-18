import { Suite, Test, BeforeEach, ShouldThrow } from '@travetto/test';
import { DependencyRegistry } from '../src/registry';
import { RootRegistry } from '@travetto/registry';

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
    } catch (err) {
      console.error('Failed to load dependency', { error: err });
      throw err;
    }
  }
}