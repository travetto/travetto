import assert from 'node:assert';
import type { IndexDescriptionInfo } from 'mongodb';

import { Suite, Test } from '@travetto/test';

import { MongoUtil, type BasicIdx } from '../src/internal/util.ts';

@Suite()
export class MongoUtilTests {

  @Test()
  async shouldDetectNoChange() {
    const existing: IndexDescriptionInfo = {
      key: { name: 1, age: -1 },
      name: 'name_1_age_-1',
      unique: true,
      sparse: false
    };

    const pending: [BasicIdx, { unique?: boolean, sparse?: boolean }] = [
      { name: 1, age: -1 },
      { unique: true, sparse: false }
    ];

    const result = MongoUtil.isIndexChanged(existing, pending);
    assert.strictEqual(result, false, 'Should detect no change when indices match');
  }

  @Test()
  async shouldDetectUniqueChange() {
    const existing: IndexDescriptionInfo = {
      key: { name: 1 },
      name: 'name_1',
      unique: false
    };

    const pending: [BasicIdx, { unique?: boolean }] = [
      { name: 1 },
      { unique: true }
    ];

    const result = MongoUtil.isIndexChanged(existing, pending);
    assert.strictEqual(result, true, 'Should detect unique option change');
  }

  @Test()
  async shouldDetectSparseChange() {
    const existing: IndexDescriptionInfo = {
      key: { email: 1 },
      name: 'email_1',
      sparse: true
    };

    const pending: [BasicIdx, { sparse?: boolean }] = [
      { email: 1 },
      { sparse: false }
    ];

    const result = MongoUtil.isIndexChanged(existing, pending);
    assert.strictEqual(result, true, 'Should detect sparse option change');
  }

  @Test()
  async shouldDetectExpireAfterSecondsChange() {
    const existing: IndexDescriptionInfo = {
      key: { createdAt: 1 },
      name: 'createdAt_1',
      expireAfterSeconds: 3600
    };

    const pending: [BasicIdx, { expireAfterSeconds?: number }] = [
      { createdAt: 1 },
      { expireAfterSeconds: 7200 }
    ];

    const result = MongoUtil.isIndexChanged(existing, pending);
    assert.strictEqual(result, true, 'Should detect expireAfterSeconds change');
  }

  @Test()
  async shouldDetectBucketSizeChange() {
    const existing: IndexDescriptionInfo = {
      key: { location: '2d' },
      name: 'location_2d',
      bucketSize: 100
    };

    const pending: [BasicIdx, { bucketSize?: number }] = [
      { location: '2d' },
      { bucketSize: 200 }
    ];

    const result = MongoUtil.isIndexChanged(existing, pending);
    assert.strictEqual(result, true, 'Should detect bucketSize change');
  }

  @Test()
  async shouldDetectKeyCountChange() {
    const existing: IndexDescriptionInfo = {
      key: { name: 1, age: -1 },
      name: 'name_1_age_-1'
    };

    const pending: [BasicIdx, {}] = [
      { name: 1 },
      {}
    ];

    const result = MongoUtil.isIndexChanged(existing, pending);
    assert.strictEqual(result, true, 'Should detect change when key count differs');
  }

  @Test()
  async shouldDetectDifferentKeys() {
    const existing: IndexDescriptionInfo = {
      key: { name: 1, age: -1 },
      name: 'name_1_age_-1'
    };

    const pending: [BasicIdx, {}] = [
      { name: 1, email: 1 },
      {}
    ];

    const result = MongoUtil.isIndexChanged(existing, pending);
    assert.strictEqual(result, true, 'Should detect change when keys differ');
  }

  @Test()
  async shouldDetectKeyDirectionChange() {
    const existing: IndexDescriptionInfo = {
      key: { name: 1, age: -1 },
      name: 'name_1_age_-1'
    };

    const pending: [BasicIdx, {}] = [
      { name: 1, age: 1 },
      {}
    ];

    const result = MongoUtil.isIndexChanged(existing, pending);
    assert.strictEqual(result, false, 'Should return false when key direction changes (bug in original)');
  }

  @Test()
  async shouldHandleTextIndex() {
    const existing: IndexDescriptionInfo = {
      key: { description: 'text' },
      name: 'description_text'
    };

    const pending: [BasicIdx, {}] = [
      { description: 'text' },
      {}
    ];

    const result = MongoUtil.isIndexChanged(existing, pending);
    assert.strictEqual(result, false, 'Should handle text index');
  }

  @Test()
  async shouldHandleGeoIndex() {
    const existing: IndexDescriptionInfo = {
      key: { location: '2d' },
      name: 'location_2d'
    };

    const pending: [BasicIdx, {}] = [
      { location: '2d' },
      {}
    ];

    const result = MongoUtil.isIndexChanged(existing, pending);
    assert.strictEqual(result, false, 'Should handle 2d geo index');
  }

  @Test()
  async shouldHandleCompoundIndex() {
    const existing: IndexDescriptionInfo = {
      key: { name: 1, age: -1, email: 1 },
      name: 'name_1_age_-1_email_1',
      unique: true
    };

    const pending: [BasicIdx, { unique?: boolean }] = [
      { name: 1, age: -1, email: 1 },
      { unique: true }
    ];

    const result = MongoUtil.isIndexChanged(existing, pending);
    assert.strictEqual(result, false, 'Should handle compound index');
  }

  @Test()
  async shouldDetectChangeWhenOptionsRemoved() {
    const existing: IndexDescriptionInfo = {
      key: { email: 1 },
      name: 'email_1',
      unique: true,
      sparse: true
    };

    const pending: [BasicIdx, {}] = [
      { email: 1 },
      {}
    ];

    const result = MongoUtil.isIndexChanged(existing, pending);
    assert.strictEqual(result, true, 'Should detect change when options are removed');
  }

  @Test()
  async shouldHandleEmptyOptions() {
    const existing: IndexDescriptionInfo = {
      key: { name: 1 },
      name: 'name_1'
    };

    const pending: [BasicIdx, {}] = [
      { name: 1 },
      {}
    ];

    const result = MongoUtil.isIndexChanged(existing, pending);
    assert.strictEqual(result, false, 'Should handle empty options');
  }

  @Test()
  async shouldDetectPartialKeyOverlap() {
    const existing: IndexDescriptionInfo = {
      key: { name: 1, age: -1, email: 1 },
      name: 'name_1_age_-1_email_1'
    };

    const pending: [BasicIdx, {}] = [
      { name: 1, age: -1, city: 1 },
      {}
    ];

    const result = MongoUtil.isIndexChanged(existing, pending);
    assert.strictEqual(result, true, 'Should detect partial key overlap');
  }
}
