import assert from 'node:assert';

import { Suite, Test, ShouldThrow } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';

@Suite('cycle')
class CycleTest {

  @Test()
  @ShouldThrow('dependency')
  async tryCycle() {
    try {
      const A = await import('./cycle/a.ts');
      const B = await import('./cycle/b.ts');
      assert(B !== undefined);
      await RootRegistry.init();

      const { ABC } = await import('./cycle/a.ts');
      const result = await DependencyRegistry.getInstance(ABC);
      console.log('Loaded dependency', { instance: result.constructor.name });
    } catch {
      throw new Error('Failed to load dependency');
    }
  }
}