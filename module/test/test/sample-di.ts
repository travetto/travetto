import { Injectable, DependencyRegistry } from '@encore2/di';
import * as test from 'tape';

@Injectable()
export class Test {
  name: string;

  postConstruct() {
    this.name = 'Howdy';
  }
  getName() {
    return this.name;
  }
}

test('Test loading', async t => {
  await DependencyRegistry.init();
  let item = await DependencyRegistry.getInstance(Test);
  t.is(item.getName(), 'Howdy');
});
