import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';
import { ElasticsearchSchemaUtil } from '../src/internal/schema';

@Suite()
export class UtilTest {

  @Test()
  updateScript() {
    const text = ElasticsearchSchemaUtil.generateUpdateScript({
      name: 'bob',
      age: 20
    });
    assert(text.source === 'ctx._source.name = params.name;ctx._source.age = params.age');
    assert.deepStrictEqual(text.params, { name: 'bob', age: 20 });

    const text2 = ElasticsearchSchemaUtil.generateUpdateScript({
      name: 'bob',
      age: undefined
    });
    assert(text2.source === 'ctx._source.name = params.name;ctx._source.remove("age")');
    assert.deepStrictEqual(text2.params, { name: 'bob' });

    const text3 = ElasticsearchSchemaUtil.generateUpdateScript({
      child: {
        name: 'bob',
        age: undefined
      }
    });
    assert(text3.source === 'ctx._source.child = ctx._source.child == null ? [:] : ctx._source.child;ctx._source.child.name = params.child_name;ctx._source.child.remove("age")');
    assert.deepStrictEqual(text3.params, { child_name: 'bob' });

    const text4 = ElasticsearchSchemaUtil.generateUpdateScript({
      child: {
        name: 'bob\n',
        age: undefined
      }
    });
    assert(text4.source === 'ctx._source.child = ctx._source.child == null ? [:] : ctx._source.child;ctx._source.child.name = params.child_name;ctx._source.child.remove("age")');
    assert.deepStrictEqual(text4.params, { child_name: 'bob\n' });

    // const text5 = ElasticsearchSchemaUtil.generateUpdateScript({
    //   child: {
    //     name: 'bob\\',
    //     age: undefined
    //   }
    // });
    // assert(text5 === 'ctx._source.child.name = "bob\\\\";ctx._source.child.remove("age")');
  }
}