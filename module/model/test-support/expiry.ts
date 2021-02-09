import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { ExpiresAt, Model } from '../src/registry/decorator';
import { ModelExpirySupport } from '../src/service/expiry';
import { BaseModel } from '../src/types/base';
import { BaseModelSuite } from './base';

@Model('expiry-user')
class User extends BaseModel {
  @ExpiresAt()
  expiresAt?: Date;
}

@Suite()
export abstract class ModelExpirySuite extends BaseModelSuite<ModelExpirySupport> {

  baseLatency = 10;

  @Test()
  async basic() {
    const service = await this.service;
    const res = await service.upsertWithExpiry(User, User.from({}), 1000);
    assert(res instanceof User);

    const expiry = await service.getExpiry(User, res.id!);
    assert(!expiry.expired);
  }

  @Test()
  async aging() {
    const service = await this.service;
    const res = await service.upsertWithExpiry(User, User.from({}), 10);
    assert(res instanceof User);

    await this.wait(100);

    const expiry = await service.getExpiry(User, res.id!);
    assert(expiry.expired);
  }

  @Test()
  async ageWithExtension() {
    const service = await this.service;
    const res = await service.upsertWithExpiry(User, User.from({}), 5000);
    assert(res instanceof User);

    await this.wait(100);

    assert(!(await service.getExpiry(User, res.id!)).expired);
    await service.updateExpiry(User, res.id!, 10);

    await this.wait(100);

    assert((await service.getExpiry(User, res.id!)).expired);
  }

  @Test()
  async culling() {
    const service = await this.service;
    if (service.deleteExpired) {
      // Create
      await Promise.all(
        ' '.repeat(10).split('')
          .map((x, i) => service.upsertWithExpiry(User, User.from({}), 1000 + i))
      );

      let total;
      // Let expire
      await this.wait(1);

      total = await service.deleteExpired(User);
      assert(total === 0);

      // Let expire
      await this.wait(1100);

      total = await service.deleteExpired(User);
      assert(total === 10);

      total = await service.deleteExpired(User);
      assert(total === 0);
    }
  }
}