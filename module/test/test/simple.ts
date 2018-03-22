import { Suite, Test, BeforeAll, AfterEach, AfterAll, BeforeEach } from '../';
import * as assert from 'assert';

let a: any = 0; a = 2;

@Suite()
class Simple {

  @BeforeAll()
  initAll() {
    console.debug('b4-all');
  }

  @BeforeEach()
  initEach() {
    console.debug('b4-each');
  }

  @AfterAll()
  deinitAll() {
    console.debug('aft-all');
  }

  @AfterEach()
  deinitEach() {
    console.debug('aft-each');
  }

  @Test()
  test1a() {
    console.log('howdy');
    assert(1 === 1);
  }

  @Test()
  test1b() {
    assert(1 === 1);
  }

  @Test()
  test1c() {
    assert(1 === 1);
  }

  @Test()
  async test1d() {
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert(1 === a.range.top);
  }
}