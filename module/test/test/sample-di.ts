import { Injectable, DependencyRegistry } from '@encore2/di';
import { Suite, Test } from '../';
import * as assert from 'assert';

@Injectable()
export class TestItem {
  name: string;

  postConstruct() {
    this.name = 'Howdy';
  }
  getName() {
    return this.name;
  }
}

@Suite()
class DITest {

  @Test('Test Loading')
  async loading() {
    await DependencyRegistry.init();
    let item = await DependencyRegistry.getInstance(TestItem);
    assert.strictEqual(item.getName(), 'Howdy');
  }
}