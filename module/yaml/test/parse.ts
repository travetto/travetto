
import * as assert from 'assert';

import { Util } from '@travetto/base';
import { Suite, Test } from '@travetto/test';

import { SimpleObject } from '../src/internal/type/common';
import { YamlUtil } from '../src/util';

@Suite()
export class ParserTest {
  @Test()
  testFullText() {
    const output = YamlUtil.parse(`
- |
  a
  b
  c

  d`);
    assert.deepStrictEqual(output, ['a\nb\nc\n\nd']);
  }

  @Test()
  testMarkdown() {
    const output = YamlUtil.parse(`
- |
 # Hello World
 ## Sub
 ### Sub Sub

 *bold*
 `);

    assert.deepStrictEqual(output, ['# Hello World\n## Sub\n### Sub Sub\n\n*bold*']);
  }

  @Test()
  testInlineText() {
    const output = YamlUtil.parse(`
- >
  a
  b
  c
  

  d`);

    assert.deepStrictEqual(output, ['a b c\n\nd']);
  }

  @Test()
  testComplex() {
    const output = YamlUtil.parse(`
---
a: 10
b: 20
c: 30 # Random comment
# More comments

'd"a':
  - 1
  - 2
  - 3
  -
     aa: 20
     age: 20
     bb: 200
  - [1,2,3,4]
  - >
    a
    b
    c

    d
e: {"a": 20, "c": 30}
age: 20
`);
    assert.deepStrictEqual(output, {
      a: 10,
      b: 20,
      c: 30,
      ['d"a']: [
        1,
        2,
        3,
        {
          aa: 20,
          age: 20,
          bb: 200,
        },
        [1, 2, 3, 4],
        'a b c\nd'
      ],
      e: {
        a: 20,
        c: 30
      },
      age: 20
    });
  }

  @Test()
  testNestedLists() {
    assert(true);
    const output = YamlUtil.parse(`
---
- - 1
  - 2
- - a: 4
  - c: 5
  - d: 6
    `);

    assert.deepStrictEqual(output, [[1, 2], [{ a: 4 }, { c: 5 }, { d: 6 }]]);
  }

  @Test()
  testSimple() {
    const output = YamlUtil.parse(`
---
  mail:
     transport: null
  `);
    assert.deepStrictEqual(output, { mail: { transport: null } });
  }

  @Test()
  testJSONQuotes() {
    const output = YamlUtil.parse(`
---
  mail: 'hello'
  `);
    assert.deepStrictEqual(output, { mail: 'hello' });

    const output2 = YamlUtil.parse(`
---
  mail: ['hello']
  `);
    assert.deepStrictEqual(output2, { mail: ['hello'] });

    const output3 = YamlUtil.parse(`
---
  mail: { 'hello' : 'goodbye' }
          `);
    assert.deepStrictEqual(output3, { mail: { hello: 'goodbye' } });

    const output4 = YamlUtil.parse(`
---
  mail: { hello : 'goodbye' }
          `);
    assert.deepStrictEqual(output4, { mail: { hello: 'goodbye' } });
  }

  @Test()
  testDashes() {
    const output = YamlUtil.parse(`
---
  mail-settings:
    name: 'hello'
    age-num: 20
  `);
    assert.deepStrictEqual(output, { 'mail-settings': { name: 'hello', 'age-num': 20 } });
  }

  @Test()
  emptyFile() {
    const output = YamlUtil.parse(`#
# `);
    assert.deepStrictEqual(output, {});
  }

  @Test()
  blankFile() {
    const output = YamlUtil.parse('');
    assert.deepStrictEqual(output, {});
  }

  @Test()
  mostlyBlankFile() {
    const output = YamlUtil.parse(`#
#
#
#
name: bob
#
#
#`);
    assert.deepStrictEqual(output, { name: 'bob' });
  }

  @Test()
  flatList() {
    const output = YamlUtil.parse(`
parent:
  values:
  - 1
  - 2
  - 3
`);

    assert.deepStrictEqual(output, { parent: { values: [1, 2, 3] } });
  }

  @Test()
  singleList() {
    const output = YamlUtil.parse(`--
config:
  redacted:
    - panda.user
panda.user: bob`) as SimpleObject;
    assert(Util.isPlainObject(output.config));
    assert.deepStrictEqual(output.config.redacted, ['panda.user']);
  }

  @Test()
  listMap() {
    const output = YamlUtil.parse(`--
add:
  - package.json
  - .trv_cache: cache
  - src`) as SimpleObject;
    assert(Array.isArray(output.add));
    assert.deepStrictEqual(output.add, ['package.json', { '.trv_cache': 'cache' }, 'src']);
  }
}