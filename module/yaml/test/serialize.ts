import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { Serializer } from '../src/internal/serializer';

@Suite()
export class SerializeTest {
  @Test()
  testWordWrap() {
    const wrap = Serializer.wordWrap('lorem ipsum whadya think about them apples, huh?', 20);
    assert(wrap === ['lorem ipsum whadya', 'think about them', 'apples, huh?']);
  }

  @Test()
  testSimple() {
    const out = Serializer.serialize({
      a: 20,
      b: 30,
      c: [
        1,
        2,
        3,
        'lorem ipsum whadya think about them apples, huh? lorem ipsum whadya think about them apples, huh? huh?'
      ]
    }, 2, 100);
    assert(out === `
a: 20
b: 30
c:
  - 1
  - 2
  - 3
  - >
    lorem ipsum whadya think about them apples, huh? lorem ipsum whadya think about them apples, huh?
    huh?`.trim());
  }
}