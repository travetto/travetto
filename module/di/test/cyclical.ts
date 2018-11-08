import { Suite, Test, BeforeEach, ShouldThrow } from '@travetto/test';
import { DependencyRegistry } from '../src/registry';

@Suite('cycle')
class CycleTest {

  @BeforeEach()
  async each() {
    await DependencyRegistry.init();
  }

  @Test()
  @ShouldThrow('cyclical dependency')
  async tryCycle() {
    const { BCD } = require('./cycle/b');
  }
}