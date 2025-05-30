import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { QueryLanguageParser, QueryLanguageTokenizer } from '@travetto/model-query-language';


type UserType<R = string> = { user: { address: { state: String, city: string }, role: R } };

@Suite('Query String Tests')
export class QueryStringTest {

  @Test('Tokenizer')
  async tokenize() {
    assert.deepStrictEqual(QueryLanguageTokenizer.tokenize('A(B,C,D)'), [
      { type: 'identifier', value: 'A' },
      { type: 'grouping', value: 'start' },
      { type: 'identifier', value: 'B' },
      { type: 'punctuation', value: ',' },
      { type: 'identifier', value: 'C' },
      { type: 'punctuation', value: ',' },
      { type: 'identifier', value: 'D' },
      { type: 'grouping', value: 'end' }
    ]);
    assert.deepStrictEqual(QueryLanguageTokenizer.tokenize('A.b.c  ==  D'), [
      { type: 'identifier', value: 'A.b.c' },
      { type: 'operator', value: '==' },
      { type: 'identifier', value: 'D' },
    ]);
    assert.deepStrictEqual(QueryLanguageTokenizer.tokenize(`"${'A.b.c'}"   =='  D'`), [
      { type: 'literal', value: 'A.b.c' },
      { type: 'operator', value: '==' },
      { type: 'literal', value: '  D' }
    ]);

    assert.throws(() => {
      QueryLanguageTokenizer.tokenize('"hello');
    }, 'Unterminated string literal');

    assert.doesNotThrow(() => {
      QueryLanguageTokenizer.tokenize('"hello"');
    });

    assert.deepStrictEqual(QueryLanguageTokenizer.tokenize('A ~ /b.c.d/'), [
      { type: 'identifier', value: 'A' },
      { type: 'operator', value: '~' },
      { type: 'literal', value: /b.c.d/ }
    ]);
  }

  @Test('Parser')
  async parseSimple() {
    const parsed = QueryLanguageParser.parseToQuery('A == 5 and B == 6 or C == -7 and d == 8 or e == 10');
    assert.deepStrictEqual(parsed, {
      $or: [
        {
          $and: [
            { A: { $eq: 5 } },
            { B: { $eq: 6 } }
          ]
        },
        {
          $and: [
            { C: { $eq: -7 } },
            { d: { $eq: 8 } }
          ]
        },
        { e: { $eq: 10 } }
      ]
    });
  }

  @Test('Parse Complex Boolean')
  async parseComplexBoolean() {
    const res2 = QueryLanguageParser.parseToQuery('A == 5 and (B == 6 or C == 7 and G == 1) and d == 8 or e == 10');
    assert.deepStrictEqual(res2, {
      $or: [
        {
          $and: [
            {
              $and: [
                { A: { $eq: 5 } },
                {
                  $or: [
                    { B: { $eq: 6 } },
                    {
                      $and: [
                        { C: { $eq: 7 } },
                        { G: { $eq: 1 } }
                      ],
                    }
                  ],
                }
              ]
            },
            { d: { $eq: 8 } }
          ]
        },
        { e: { $eq: 10 } }
      ]
    });
  }

  @Test('Parse Negation')
  async parseNegation() {
    const res2 = QueryLanguageParser.parseToQuery('A == 5 and NOT B == 6');
    assert.deepStrictEqual(res2, {
      $and: [
        { A: { $eq: 5 } },
        { $not: { B: { $eq: 6 } } }
      ]
    });
  }

  @Test('Parse Dotted Fields')
  async parseFields() {
    const res2 = QueryLanguageParser.parseToQuery('A.b.c == 5 and (NOT B.z == -6.2 OR c == /a/)');
    assert.deepStrictEqual(res2, {
      $and: [
        { A: { b: { c: { $eq: 5 } } } },
        {
          $or: [
            { $not: { B: { z: { $eq: -6.2 } } } },
            { c: { $eq: /a/ } }
          ]
        }
      ]
    });
  }

  @Test('Parse Unique Outputs')
  async parseUnique() {
    const parsed = QueryLanguageParser.parseToQuery('a.b.c in [1,2,-3]');
    assert.deepStrictEqual(parsed, {
      a: { b: { c: { $in: [1, 2, -3] } } }
    });

    const res3 = QueryLanguageParser.parseToQuery('a.b.c not-in [1,2,3]');
    assert.deepStrictEqual(res3, {
      a: { b: { c: { $nin: [1, 2, 3] } } }
    });

    const res1 = QueryLanguageParser.parseToQuery('a.b.c == null');
    assert.deepStrictEqual(res1, {
      a: { b: { c: { $exists: false } } }
    });

    const res2 = QueryLanguageParser.parseToQuery('a.b.c != null');
    assert.deepStrictEqual(res2, {
      a: { b: { c: { $exists: true } } }
    });
  }

  @Test('Parse complex')
  async parseComplex() {
    const parsed = QueryLanguageParser.parseToQuery<UserType>(
      "user.role in ['admin', 'root'] && (user.address.state == 'VA' || user.address.city == 'Springfield')");
    assert.deepStrictEqual(parsed, {
      $and: [
        { user: { role: { $in: ['admin', 'root'] } } },
        {
          $or: [
            { user: { address: { state: { $eq: 'VA' } } } },
            { user: { address: { city: { $eq: 'Springfield' } } } }
          ]
        }
      ]
    });
  }

  @Test('Parse Regex')
  async parseRegex() {
    const parsed = QueryLanguageParser.parseToQuery<UserType<{ $regex: RegExp }>>('user.role ~ /^admin/');
    assert.deepStrictEqual(parsed, { user: { role: { $regex: /^admin/ } } });
    assert(parsed.user!.role!.$regex instanceof RegExp);
    assert(parsed.user!.role!.$regex.toString() === '/^admin/');

    const res2 = QueryLanguageParser.parseToQuery<UserType<{ $regex: RegExp }>>("user.role ~ 'admin'");
    assert.deepStrictEqual(res2, { user: { role: { $regex: /^admin/ } } });
    assert(res2.user!.role!.$regex instanceof RegExp);
    assert(res2.user!.role!.$regex.toString() === '/^admin/');
  }

  @Test('Parse Regex with flags')
  async parseRegexWithFlags() {
    const parsed = QueryLanguageParser.parseToQuery<UserType<{ $regex: RegExp }>>('user.role ~ /\badmin\b/i');
    assert(parsed.user!.role!.$regex instanceof RegExp);
    assert(parsed.user!.role!.$regex.toString() === '/\badmin\b/i');
  }

  @Test('Parse Regex with word boundaries')
  async parseRegexWithWordBoundaries() {
    const parsed = QueryLanguageParser.parseToQuery<UserType<{ $regex: RegExp }>>('user.role ~ /\badmin\b/i');
    assert(parsed.user!.role!.$regex instanceof RegExp);
    assert(parsed.user!.role!.$regex.toString() === '/\badmin\b/i');
  }

  @Test('Relative date ranges')
  async parseRelativeDateRanges() {
    const parsed = QueryLanguageParser.parseToQuery<{ createdAt: { $gt: string }, deleteAt: { $gt: string } }>('createdAt > -7d AND deleteAt > 0d');
    assert.deepStrictEqual(parsed, { $and: [{ createdAt: { $gt: '-7d' } }, { deleteAt: { $gt: '0d' } }] });
  }
}