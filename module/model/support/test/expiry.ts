import assert from 'node:assert';
import timers from 'node:timers/promises';

import { Suite, Test } from '@travetto/test';
import { TimeSpan, TimeUnit, TimeUtil } from '@travetto/runtime';

import { ExpiresAt, Model } from '../../src/registry/decorator';
import { ModelExpirySupport } from '../../src/service/expiry';
import { ModelExpiryUtil } from '../../src/internal/service/expiry';
import { NotFoundError } from '../../src/error/not-found';
import { BaseModelSuite } from './base';

@Model('expiry-user')
class User {
  id: string;
  @ExpiresAt()
  expiresAt?: Date;
}

@Suite()
export abstract class ModelExpirySuite extends BaseModelSuite<ModelExpirySupport> {

  delayFactor: number = 1;

  async wait(n: number | TimeSpan) {
    await timers.setTimeout(TimeUtil.asMillis(n) * this.delayFactor);
  }

  timeFromNow(v: number | TimeSpan, unit?: TimeUnit) {
    return TimeUtil.fromNow(TimeUtil.asMillis(v, unit) * this.delayFactor);
  }

  @Test()
  async basic() {
    const service = await this.service;
    const res = await service.upsert(User, User.from({
      expiresAt: this.timeFromNow('2s')
    }));
    assert(res instanceof User);

    const expiry = ModelExpiryUtil.getExpiryState(User, await service.get(User, res.id));
    assert(!expiry.expired);
  }

  @Test()
  async aging() {
    const service = await this.service;
    const res = await service.upsert(User, User.from({
      expiresAt: this.timeFromNow(100)
    }));

    assert(res instanceof User);

    await this.wait(200);

    await assert.rejects(() => service.get(User, res.id), NotFoundError);
  }

  @Test()
  async updateExpired() {
    const service = await this.service;
    const res = await service.upsert(User, User.from({
      expiresAt: this.timeFromNow(100)
    }));

    assert(res instanceof User);

    await this.wait(200);

    await assert.rejects(() => service.update(User, User.from({ id: res.id })), NotFoundError);
  }

  @Test()
  async ageWithExtension() {
    const service = await this.service;
    const res = await service.upsert(User, User.from({
      expiresAt: this.timeFromNow('2s')
    }));
    assert(res instanceof User);

    await this.wait(50);

    assert(!ModelExpiryUtil.getExpiryState(User, (await service.get(User, res.id))).expired);

    await service.updatePartial(User, {
      id: res.id,
      expiresAt: this.timeFromNow(100)
    });

    await this.wait(200);

    await assert.rejects(() => service.get(User, res.id), NotFoundError);
  }

  @Test()
  async culling() {
    const service = await this.service;

    let total;

    total = await this.getSize(User);
    assert(total === 0);

    // Create
    await Promise.all(
      Array(10).fill(0).map((x, i) => service.upsert(User, User.from({
        expiresAt: this.timeFromNow(1000 + i * this.delayFactor)
      })))
    );

    // Let expire
    await this.wait(1);

    total = await this.getSize(User);
    assert(total === 10);

    // Let expire
    await this.wait(1100);

    total = await this.getSize(User);
    assert(total === 0);

    total = await this.getSize(User);
    assert(total === 0);
  }
}