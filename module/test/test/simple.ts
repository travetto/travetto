import { Suite, Test } from '../';
import * as assert from 'assert';

let a = 0;

@Suite()
class Simple {

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
    assert(1 === a);
  }
}