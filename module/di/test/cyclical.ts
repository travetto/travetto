import assert from 'node:assert';

import { Suite, Test, ShouldThrow } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';

import { DependencyRegistry } from '../src/registry.ts';

@Suite('cycle')
class CycleTest {

  @Test()
  @ShouldThrow('dependency')
  async tryCycle() {
    try {
      const A = await import('./cycle/a');
      const B = await import('./cycle/b');
      assert(B !== undefined);
      await RootRegistry.init();

      const { ABC } = await import('./cycle/a');
      const res = await DependencyRegistry.getInstance(ABC);
      console.log('Loaded dependency', { instance: res.constructor.name });
    } catch {
      throw new Error('Failed to load dependency');
    }
  }
}