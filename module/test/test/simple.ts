import { Suite, Test } from '../';
import * as assert from 'assert';

@Suite('Simple Suite')
class Simple {

  @Test()
  test1a() {
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
  test1d() {
    assert(1 === 1);
  }
}