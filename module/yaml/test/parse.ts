
import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { YamlUtil } from '../src/api';

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
        assert(output === [`a\nb\nc\n\nd`]);
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

        assert(output === [`# Hello World\n## Sub\n### Sub Sub\n\n*bold*`]);
    }

    @Test()
    testInlinText() {
        const output = YamlUtil.parse(`
- >
  a
  b
  c


  d`);

        assert(output === [`a b c\n\nd`]);
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
        assert(output === {
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

        assert(output === [[1, 2], [{ a: 4 }, { c: 5 }, { d: 6 }]]);
    }

    @Test()
    testSimple() {
        const output = YamlUtil.parse(`
---
  mail:
     transport: null
  `);
        assert(output === { mail: { transport: null } });
    }
}