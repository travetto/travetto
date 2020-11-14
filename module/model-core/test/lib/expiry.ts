import * as assert from 'assert';

import { AfterEach, BeforeAll, BeforeEach, Suite, Test } from '@travetto/test';

import { Model } from '../../src/registry/decorator';
import { ModelExpirySupport } from '../../src/service/expire';
import { BaseModel } from '../../src/types/base';
import { BaseModelSuite } from './test.base';

const wait = (n: number) => new Promise(res => setTimeout(res, n));

@Model()
class User extends BaseModel {
}

@Suite({ skip: true })
export abstract class ModelExpirySuite extends BaseModelSuite<ModelExpirySupport> {

  baseLatency = 10;

  @BeforeAll()
  async beforeAll() {
    return super.init();
  }

  @BeforeEach()
  async beforeEach() {
    return this.createStorage();
  }

  @AfterEach()
  async afterEach() {
    return this.deleteStorage();
  }

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

    await wait(100);

    const expiry = await service.getExpiry(User, res.id!);
    assert(expiry.expired);
  }

  @Test()
  async ageWithExtension() {
    const service = await this.service;
    const res = await service.upsertWithExpiry(User, User.from({}), 5000);
    assert(res instanceof User);

    await wait(100);

    assert(!(await service.getExpiry(User, res.id!)).expired);
    await service.updateExpiry(User, res.id!, 10);

    await wait(100);

    assert((await service.getExpiry(User, res.id!)).expired);
  }

  @Test()
  async culling() {
    const service = await this.service;
    if (service.deleteExpired) {
      // Create
      await Promise.all(
        ' '.repeat(10).split('')
          .map((x, i) => service.upsertWithExpiry(User, User.from({}), 5000 + i))
      );

      // Count
      let total = 0;
      for await (const __el of await service.list(User)) {
        total += 1;
      }
      assert(total === 10);

      // Reset expiry low
      for await (const el of await service.list(User)) {
        await service.updateExpiry(User, el.id!, 10);
      }

      // Let expire
      await wait(50);
      await service.deleteExpired(User);

      // Recount
      total = 0;
      for await (const __el of await service.list(User)) {
        total += 1;
      }
      assert(total === 0);
    }
  }
}