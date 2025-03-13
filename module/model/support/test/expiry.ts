import assert from 'node:assert';
import timers from 'node:timers/promises';

import { Suite, Test } from '@travetto/test';
import { TimeSpan, TimeUnit, TimeUtil } from '@travetto/runtime';

import { ExpiresAt, Model } from '../../src/registry/decorator.ts';
import { ModelExpirySupport } from '../../src/types/expiry.ts';
import { ModelExpiryUtil } from '../../src/util/expiry.ts';
import { NotFoundError } from '../../src/error/not-found.ts';
import { BaseModelSuite } from './base.ts';

@Model('expiry-user')
export class ExpiryUser {
  id: string;
  @ExpiresAt()
  expiresAt?: Date;
  payload?: string;
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
    const res = await service.upsert(ExpiryUser, ExpiryUser.from({
      expiresAt: this.timeFromNow('2s')
    }));
    assert(res instanceof ExpiryUser);

    const expiry = ModelExpiryUtil.getExpiryState(ExpiryUser, await service.get(ExpiryUser, res.id));
    assert(!expiry.expired);
  }

  @Test()
  async aging() {
    const service = await this.service;
    const res = await service.upsert(ExpiryUser, ExpiryUser.from({
      expiresAt: this.timeFromNow(100)
    }));

    assert(res instanceof ExpiryUser);

    await this.wait(200);

    await assert.rejects(() => service.get(ExpiryUser, res.id), NotFoundError);
  }

  @Test()
  async updateExpired() {
    const service = await this.service;
    const res = await service.upsert(ExpiryUser, ExpiryUser.from({
      expiresAt: this.timeFromNow(100)
    }));

    assert(res instanceof ExpiryUser);

    await this.wait(200);

    await assert.rejects(() => service.update(ExpiryUser, ExpiryUser.from({ id: res.id })), NotFoundError);
  }

  @Test()
  async ageWithExtension() {
    const service = await this.service;
    const res = await service.upsert(ExpiryUser, ExpiryUser.from({
      expiresAt: this.timeFromNow('2s')
    }));
    assert(res instanceof ExpiryUser);

    await this.wait(50);

    assert(!ModelExpiryUtil.getExpiryState(ExpiryUser, (await service.get(ExpiryUser, res.id))).expired);

    await service.updatePartial(ExpiryUser, {
      id: res.id,
      expiresAt: this.timeFromNow(100)
    });

    await this.wait(200);

    await assert.rejects(() => service.get(ExpiryUser, res.id), NotFoundError);
  }

  @Test()
  async culling() {
    const service = await this.service;

    let total;

    total = await this.getSize(ExpiryUser);
    assert(total === 0);

    // Create
    await Promise.all(
      Array(10).fill(0).map((x, i) => service.upsert(ExpiryUser, ExpiryUser.from({
        expiresAt: this.timeFromNow(300 + i * this.delayFactor)
      })))
    );

    // Let expire
    await this.wait(1);

    total = await this.getSize(ExpiryUser);
    assert(total === 10);

    // Let expire
    await this.wait(400);

    total = await this.getSize(ExpiryUser);
    assert(total === 0);

    total = await this.getSize(ExpiryUser);
    assert(total === 0);
  }
}