import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { Tokenizer } from '../src/internal/tokenizer';

@Suite()
export class TokenizerTest {

  @Test()
  testTokenize() {
    const inp = '   "name": "bob"   #This is a "comment"';
    const tokens = Tokenizer.tokenize(inp);
    assert(tokens === ['   ', '"name"', ':', ' ', '"bob"', '   ', '#This is a "comment"']);

    const tokens2 = Tokenizer.tokenize(inp);
    const indent = Tokenizer.getIndent(tokens2);
    assert(Tokenizer.cleanTokens(tokens2) === ['"name"', ':', ' ', '"bob"']);

    assert(indent === 3);

    const inp2 = 'lorem ipsum whadya think about them apples, huh?';
    const tokens4 = Tokenizer.tokenize(inp2, 0);
    assert(tokens4.slice(0, 5) === ['lorem', ' ', 'ipsum', ' ', 'whadya']);

    const tokens3 = Tokenizer.cleanTokens(Tokenizer.tokenize(inp2));
    assert(tokens3.length > 5);

    const tokens5 = Tokenizer.tokenize('- - 1');
    assert(tokens5 === ['-', ' ', '-', ' ', '1']);
  }

  @Test()
  testSpacing() {
    const complex = Tokenizer.tokenize("\"hello my\"name is 'bob-o-rama\\'s'");
    assert(complex === ['"hello my"', 'name', ' ', 'is', ' ', "'bob-o-rama\\'s'"]);
  }

  @Test()
  testJSON() {
    assert(true);
    const json = Tokenizer.tokenize('hello [1,2,3,4,5] #Woah');
    assert(Tokenizer.cleanTokens(json) === ['hello', ' ', '[1,2,3,4,5]']);
  }

  @Test()
  testNested() {
    const tokens = Tokenizer.tokenize('- - a: 4');
    assert(tokens === ['-', ' ', '-', ' ', 'a', ':', ' ', '4']);
  }

  @Test()
  testJSONParse() {
    const [, json] = Tokenizer.readJSON('[1,2,3,4,5]');
    assert(json === '[1,2,3,4,5]');

    const [, json2] = Tokenizer.readJSON('{1,2,3,4,5}');
    assert(json2 === '{1,2,3,4,5}');

    const [, json3] = Tokenizer.readJSON('{1,2,[3,{"4"}],5}');
    assert(json3 === '{1,2,[3,{"4"}],5}');

    const [, json4] = Tokenizer.readJSON('{1,2,[3,{"4\\"5"}],5}');
    assert(json4 === '{1,2,[3,{"4\\"5"}],5}');

    assert.throws(() => {
      Tokenizer.readJSON('{1,2,[3,{"4}],5}');
    }, Error);
  }

}