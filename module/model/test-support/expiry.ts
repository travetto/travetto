import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { TimeUnit, TimeUtil } from '@travetto/base/src/internal/time';

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

  delayFactor: number = 1;

  async getSize() {
    let i = 0;
    for await (const __el of (await this.service).list(User)) {
      i += 1;
    }
    return i;
  }

  async wait(n: number, unit: TimeUnit = 'ms') {
    await super.wait(TimeUtil.toMillis(n, unit) * this.delayFactor);
    // await (await this.service).deleteExpired(User);
  }

  getAge(v: number, unit: TimeUnit = 'ms') {
    return new Date(Date.now() + TimeUtil.toMillis(v, unit) * this.delayFactor);
  }

  @Test()
  async basic() {
    const service = await this.service;
    const res = await service.upsert(User, User.from({
      expiresAt: this.getAge(2, 's')
    }));
    assert(res instanceof User);

    const expiry = ModelExpiryUtil.getExpiryState(User, await service.get(User, res.id));
    assert(!expiry.expired);
  }

  @Test()
  async aging() {
    const service = await this.service;
    const res = await service.upsert(User, User.from({
      expiresAt: this.getAge(100, 'ms')
    }));

    assert(res instanceof User);

    await this.wait(200);

    await assert.rejects(() => service.get(User, res.id), NotFoundError);
  }

  @Test()
  async updateExpired() {
    const service = await this.service;
    const res = await service.upsert(User, User.from({
      expiresAt: this.getAge(100, 'ms')
    }));

    assert(res instanceof User);

    await this.wait(200);

    await assert.rejects(() => service.update(User, User.from({ id: res.id })), NotFoundError);
  }

  @Test()
  async ageWithExtension() {
    const service = await this.service;
    const res = await service.upsert(User, User.from({
      expiresAt: this.getAge(2, 's')
    }));
    assert(res instanceof User);

    await this.wait(50);

    assert(!ModelExpiryUtil.getExpiryState(User, (await service.get(User, res.id))).expired);

    await service.updatePartial(User, {
      id: res.id,
      expiresAt: this.getAge(100)
    });

    await this.wait(200);

    await assert.rejects(() => service.get(User, res.id), NotFoundError);
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
        expiresAt: this.getAge(1000 + i * this.delayFactor)
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