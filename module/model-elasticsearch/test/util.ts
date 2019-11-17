import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';
import { ElasticsearchUtil } from '../src/util';

/* eslint-disable @typescript-eslint/camelcase */

@Suite()
export class UtilTest {

  @Test()
  updateScript() {
    const text = ElasticsearchUtil.generateUpdateScript({
      name: 'bob',
      age: 20
    });
    assert(text.source === 'ctx._source.name = params.name;ctx._source.age = params.age');
    assert(text.params === { name: 'bob', age: 20 });

    const text2 = ElasticsearchUtil.generateUpdateScript({
      name: 'bob',
      age: undefined
    });
    assert(text2.source === 'ctx._source.name = params.name;ctx._source.remove("age")');
    assert(text2.params === { name: 'bob' });

    const text3 = ElasticsearchUtil.generateUpdateScript({
      child: {
        name: 'bob',
        age: undefined
      }
    });
    assert(text3.source === 'ctx._source.child = ctx._source.child == null ? [:] : ctx._source.child;ctx._source.child.name = params.child_name;ctx._source.child.remove("age")');
    assert(text3.params === { child_name: 'bob' });

    const text4 = ElasticsearchUtil.generateUpdateScript({
      child: {
        name: 'bob\n',
        age: undefined
      }
    });
    assert(text4.source === 'ctx._source.child = ctx._source.child == null ? [:] : ctx._source.child;ctx._source.child.name = params.child_name;ctx._source.child.remove("age")');
    assert(text4.params === { child_name: 'bob\n' });

    // const text5 = ElasticsearchUtil.generateUpdateScript({
    //   child: {
    //     name: 'bob\\',
    //     age: undefined
    //   }
    // });
    // assert(text5 === 'ctx._source.child.name = "bob\\\\";ctx._source.child.remove("age")');
  }
}