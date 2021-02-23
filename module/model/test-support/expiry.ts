import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { TimeUtil } from '@travetto/base/src/internal/time';

import { ExpiresAt, Model } from '../src/registry/decorator';
import { ModelExpirySupport } from '../src/service/expiry';
import { BaseModel } from '../src/types/base';
import { ModelExpiryUtil } from '../src/internal/service/expiry';
import { NotFoundError } from '../src/error/not-found';
import { BaseModelSuite } from './base';

@Model('expiry-user')
class User extends BaseModel {
  @ExpiresAt()
  expiresAt?: Date;
}

@Suite()
export abstract class ModelExpirySuite extends BaseModelSuite<ModelExpirySupport> {

  baseLatency = 10;

  async getSize() {
    let i = 0;
    for await (const __el of (await this.service).list(User)) {
      i += 1;
    }
    return i;
  }

  async wait(ms: number) {
    await super.wait(ms);
    await (await this.service).deleteExpired(User);
  }

  @Test()
  async basic() {
    const service = await this.service;
    const res = await service.upsert(User, User.from({
      expiresAt: TimeUtil.withAge(10, 's')
    }));
    assert(res instanceof User);

    const expiry = ModelExpiryUtil.getExpiryState(User, await service.get(User, res.id!));
    assert(!expiry.expired);
  }

  @Test()
  async aging() {
    const service = await this.service;
    const res = await service.upsert(User, User.from({
      expiresAt: TimeUtil.withAge(10)
    }));

    assert(res instanceof User);

    await this.wait(100);

    await assert.rejects(() => service.get(User, res.id!), NotFoundError);
  }

  @Test()
  async ageWithExtension() {
    const service = await this.service;
    const res = await service.upsert(User, User.from({
      expiresAt: TimeUtil.withAge(5, 's')
    }));
    assert(res instanceof User);

    await this.wait(100);

    assert(!ModelExpiryUtil.getExpiryState(User, (await service.get(User, res.id!))).expired);
    await service.updatePartial(User, res.id!, {
      expiresAt: TimeUtil.withAge(10)
    });

    await this.wait(100);

    await assert.rejects(() => service.get(User, res.id!), NotFoundError);
  }

  @Test()
  async culling() {
    const service = await this.service;

    let total;

    total = await this.getSize();
    assert(total === 0);

    // Create
    await Promise.all(
      Array(10).fill(0).map((x, i) => service.upsert(User, User.from({
        expiresAt: TimeUtil.withAge(1000 + i)
      })))
    );

    // Let expire
    await this.wait(1);

    total = await this.getSize();
    assert(total === 10);

    // Let expire
    await this.wait(1100);

    total = await this.getSize();
    assert(total === 0);

    total = await this.getSize();
    assert(total === 0);
  }
}