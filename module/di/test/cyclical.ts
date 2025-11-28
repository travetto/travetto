import assert from 'node:assert';

import { Suite, Test, ShouldThrow } from '@travetto/test';
import { Registry } from '@travetto/registry';
import { DependencyRegistryIndex } from '@travetto/di';

@Suite('cycle')
class CycleTest {

  @Test()
  @ShouldThrow('dependency')
  async tryCycle() {
    try {
      const A = await import('./cycle/a.ts');
      const B = await import('./cycle/b.ts');
      assert(B !== undefined);
      await Registry.init();

      const { ABC } = await import('./cycle/a.ts');
      const result = await DependencyRegistryIndex.getInstance(ABC);
      console.log('Loaded dependency', { instance: result.constructor.name });
    } catch {
      throw new Error('Failed to load dependency');
    }
  }
}