import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { Index, Model } from '../../src/registry/decorator';
import { BaseModel } from '../../src/types/base';
import { ModelIndexedSupport } from '../../src/service/indexed';
import { BaseModelSuite } from './test.base';
import { NotFoundError } from '../../src/error/not-found';

@Model()
@Index({
  name: 'userName',
  fields: [{ name: 1 }]
})
class User extends BaseModel {
  name?: string;
}

@Model()
class User2 extends BaseModel {
  name: string;
}

@Suite({ skip: true })
export abstract class ModelIndexedSuite extends BaseModelSuite<ModelIndexedSupport> {
  @Test()
  async writeAndRead() {
    const service = await this.service;


    await service.create(User, User.from({ name: 'bob1' }));
    await service.create(User, User.from({ name: 'bob2' }));

    const found1 = await service.getByIndex(User, 'userName', {
      name: 'bob1'
    });

    assert(found1.name === 'bob1');


    const found2 = await service.getByIndex(User, 'userName', {
      name: 'bob2'
    });

    assert(found2.name === 'bob2');
  }

  @Test()
  async readMissingIndex() {
    const service = await this.service;
    await assert.rejects(() => service.getByIndex(User, 'missing', {}), NotFoundError);
  }

  @Test()
  async readMissingValue() {
    const service = await this.service;
    await assert.rejects(() => service.getByIndex(User, 'userName', { name: 'jim' }), NotFoundError);
  }

  @Test()
  async readDifferentType() {
    const service = await this.service;
    await assert.rejects(() => service.getByIndex(User2, 'userName', { name: 'jim' }), NotFoundError);
  }

}
