import { Injectable, DependencyRegistry } from '@encore2/di';
import { expect } from 'chai';

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

describe('Test Somethin', () => {
  it('Test loading', async () => {
    let item = await DependencyRegistry.getInstance(Test);
    expect(item.getName()).to.equal('Howdy');
  });
});