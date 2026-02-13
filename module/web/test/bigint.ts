import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Schema, Min, Max } from '@travetto/schema';
import { Controller, Post, Get, QueryParam } from '@travetto/web';

import { BaseWebSuite } from '@travetto/web/support/test/suite/base.ts';
import { LocalRequestDispatcher } from '@travetto/web/support/test/dispatcher.ts';

@Schema()
class BigIntModel {
  id: bigint;
  value: bigint;
  name: string;
}

@Schema()
class BigIntRangeModel {
  @Min(0n) @Max(1000n)
  amount: bigint;
}

@Schema()
class BigIntArrayModel {
  values: bigint[];
}

@Schema()
class BigIntOptionalModel {
  required: bigint;
  optional?: bigint;
}

@Schema()
class MixedTypesModel {
  bigIntValue: bigint;
  numberValue: number;
  stringValue: string;
  booleanValue: boolean;
}

@Controller('/test/bigint')
class BigIntAPI {
  @Post('/model')
  async saveModel(model: BigIntModel) {
    return model;
  }

  @Get('/model')
  async getModel(model: BigIntModel) {
    return model;
  }

  @Post('/range')
  async saveRange(model: BigIntRangeModel) {
    return model;
  }

  @Post('/array')
  async saveArray(model: BigIntArrayModel) {
    return model;
  }

  @Post('/optional')
  async saveOptional(model: BigIntOptionalModel) {
    return model;
  }

  @Post('/mixed')
  async saveMixed(model: MixedTypesModel) {
    return model;
  }

  @Get('/query')
  async queryBigInt(@QueryParam() value: bigint) {
    return { value };
  }

  @Get('/query-array')
  async queryBigIntArray(@QueryParam() values: bigint[]) {
    return { values };
  }
}

@Suite()
class BigIntWebTest extends BaseWebSuite {
  dispatcherType = LocalRequestDispatcher;

  @Test()
  async testBigIntInBody() {
    // Send bigint as string with 'n' suffix (the format the server sends)
    const response1 = await this.request<{ id: string, value: string, name: string }>({
      context: { httpMethod: 'POST', path: '/test/bigint/model' },
      body: { id: '123n', value: '456789012345678901234567890n', name: 'test' }
    });

    assert(response1.body);
    // BigInt values are serialized as strings with 'n' suffix in JSON responses
    assert.strictEqual(response1.body.id, 123n);
    assert.strictEqual(response1.body.value, 456789012345678901234567890n);
    assert.strictEqual(response1.body.name, 'test');

    // Send bigint as numeric string (without 'n' suffix)
    const response2 = await this.request<{ id: string, value: string, name: string }>({
      context: { httpMethod: 'POST', path: '/test/bigint/model' },
      body: { id: '999', value: '123456789012345', name: 'test2' }
    });

    assert(response2.body);
    assert.strictEqual(response2.body.id, 999n);
    assert.strictEqual(response2.body.value, 123456789012345n);
    assert.strictEqual(response2.body.name, 'test2');

    // Send bigint as number (for values within safe integer range)
    const response3 = await this.request<{ id: string, value: string, name: string }>({
      context: { httpMethod: 'POST', path: '/test/bigint/model' },
      body: { id: 42, value: 9007199254740991, name: 'test3' }
    });

    assert(response3.body);
    assert.strictEqual(response3.body.id, 42n);
    assert.strictEqual(response3.body.value, 9007199254740991n);
    assert.strictEqual(response3.body.name, 'test3');
  }

  @Test()
  async testBigIntInQuery() {
    // BigInt as string with 'n' suffix
    const response1 = await this.request<{ value: string }>({
      context: {
        httpMethod: 'GET',
        path: '/test/bigint/query',
        httpQuery: { value: '123456789n' }
      }
    });

    assert(response1.body);
    assert.strictEqual(response1.body.value, 123456789n);

    // BigInt as numeric string
    const response2 = await this.request<{ value: string }>({
      context: {
        httpMethod: 'GET',
        path: '/test/bigint/query',
        httpQuery: { value: '987654321' }
      }
    });

    assert(response2.body);
    assert.strictEqual(response2.body.value, 987654321n);

    // BigInt as number
    const response3 = await this.request<{ value: string }>({
      context: {
        httpMethod: 'GET',
        path: '/test/bigint/query',
        httpQuery: { value: 999 }
      }
    });

    assert(response3.body);
    assert.strictEqual(response3.body.value, 999n);
  }

  @Test()
  async testBigIntArray() {
    const response1 = await this.request<{ values: string[] }>({
      context: { httpMethod: 'POST', path: '/test/bigint/array' },
      body: { values: ['1n', '2n', '3n'] }
    });

    assert(response1.body);
    assert.strictEqual(response1.body.values.length, 3);
    assert.strictEqual(response1.body.values[0], 1n);
    assert.strictEqual(response1.body.values[1], 2n);
    assert.strictEqual(response1.body.values[2], 3n);

    const response2 = await this.request<{ values: string[] }>({
      context: { httpMethod: 'POST', path: '/test/bigint/array' },
      body: { values: ['100', '200', '300'] }
    });

    assert(response2.body);
    assert.strictEqual(response2.body.values.length, 3);
    assert.strictEqual(response2.body.values[0], 100n);
    assert.strictEqual(response2.body.values[1], 200n);
    assert.strictEqual(response2.body.values[2], 300n);

    const response3 = await this.request<{ values: string[] }>({
      context: { httpMethod: 'POST', path: '/test/bigint/array' },
      body: { values: [10, 20, 30] }
    });

    assert(response3.body);
    assert.strictEqual(response3.body.values.length, 3);
    assert.strictEqual(response3.body.values[0], 10n);
    assert.strictEqual(response3.body.values[1], 20n);
    assert.strictEqual(response3.body.values[2], 30n);
  }

  @Test()
  async testBigIntArrayQuery() {
    const response1 = await this.request<{ values: string[] }>({
      context: {
        httpMethod: 'GET',
        path: '/test/bigint/query-array',
        httpQuery: { values: ['1n', '2n', '3n'] }
      }
    });

    assert(response1.body);
    assert.strictEqual(response1.body.values.length, 3);
    assert.strictEqual(response1.body.values[0], 1n);
    assert.strictEqual(response1.body.values[1], 2n);
    assert.strictEqual(response1.body.values[2], 3n);

    const response2 = await this.request<{ values: string[] }>({
      context: {
        httpMethod: 'GET',
        path: '/test/bigint/query-array',
        httpQuery: { values: ['100', '200', '300'] }
      }
    });

    assert(response2.body);
    assert.strictEqual(response2.body.values.length, 3);
    assert.strictEqual(response2.body.values[0], 100n);
    assert.strictEqual(response2.body.values[1], 200n);
    assert.strictEqual(response2.body.values[2], 300n);
  }

  @Test()
  async testBigIntRange() {
    // Valid range
    const response1 = await this.request<{ amount: string }>({
      context: { httpMethod: 'POST', path: '/test/bigint/range' },
      body: { amount: '500n' }
    });

    assert(response1.body);
    assert.strictEqual(response1.body.amount, 500n);

    // Below minimum
    const response2 = await this.request<{ message: string }>({
      context: { httpMethod: 'POST', path: '/test/bigint/range' },
      body: { amount: '-10n' }
    }, false);

    assert.strictEqual(response2.context.httpStatusCode, 400);
    assert(/Validation errors/.test(response2.body?.message ?? ''));

    // Above maximum
    const response3 = await this.request<{ message: string }>({
      context: { httpMethod: 'POST', path: '/test/bigint/range' },
      body: { amount: '2000n' }
    }, false);

    assert.strictEqual(response3.context.httpStatusCode, 400);
    assert(/Validation errors/.test(response3.body?.message ?? ''));
  }

  @Test()
  async testBigIntOptional() {
    // With both values
    const response1 = await this.request<{ required: string, optional?: string }>({
      context: { httpMethod: 'POST', path: '/test/bigint/optional' },
      body: { required: '100n', optional: '200n' }
    });

    assert(response1.body);
    assert.strictEqual(response1.body.required, 100n);
    assert.strictEqual(response1.body.optional, 200n);

    // Without optional
    const response2 = await this.request<{ required: string, optional?: string }>({
      context: { httpMethod: 'POST', path: '/test/bigint/optional' },
      body: { required: '100n' }
    });

    assert(response2.body);
    assert.strictEqual(response2.body.required, 100n);
    assert(response2.body.optional === undefined);

    // Missing required
    const response3 = await this.request<{ message: string }>({
      context: { httpMethod: 'POST', path: '/test/bigint/optional' },
      body: { optional: '200n' }
    }, false);

    assert.strictEqual(response3.context.httpStatusCode, 400);
    assert(/Validation errors/.test(response3.body?.message ?? ''));
  }

  @Test()
  async testMixedTypes() {
    const response = await this.request<{ bigIntValue: string, numberValue: number, stringValue: string, booleanValue: boolean }>({
      context: { httpMethod: 'POST', path: '/test/bigint/mixed' },
      body: {
        bigIntValue: '9007199254740991n',
        numberValue: 42.5,
        stringValue: 'hello',
        booleanValue: true
      }
    });

    assert(response.body);
    assert.strictEqual(response.body.bigIntValue, 9007199254740991n);
    assert.strictEqual(response.body.numberValue, 42.5);
    assert.strictEqual(response.body.stringValue, 'hello');
    assert.strictEqual(response.body.booleanValue, true);
  }

  @Test()
  async testBigIntInvalidValues() {
    // Invalid bigint value (decimal)
    const response1 = await this.request<{ message: string }>({
      context: { httpMethod: 'POST', path: '/test/bigint/model' },
      body: { id: '123.45', value: '1n', name: 'test' }
    }, false);

    assert.strictEqual(response1.context.httpStatusCode, 400);
    assert(/Validation errors/.test(response1.body?.message ?? ''));

    // Invalid bigint value (non-numeric)
    const response2 = await this.request<{ message: string }>({
      context: { httpMethod: 'POST', path: '/test/bigint/model' },
      body: { id: 'abc', value: '1n', name: 'test' }
    }, false);

    assert.strictEqual(response2.context.httpStatusCode, 400);
    assert(/Validation errors/.test(response2.body?.message ?? ''));
  }

  @Test()
  async testLargeBigIntValues() {
    // Very large bigint that exceeds Number.MAX_SAFE_INTEGER
    const largeValue = '99999999999999999999999999999n';

    const response = await this.request<{ id: string, value: string, name: string }>({
      context: { httpMethod: 'POST', path: '/test/bigint/model' },
      body: { id: '1n', value: largeValue, name: 'large' }
    });

    assert(response.body);
    // BigInt serialized back as string with 'n' suffix
    assert.strictEqual(response.body.value, 99999999999999999999999999999n);
    assert.strictEqual(response.body.name, 'large');
  }

  @Test()
  async testBigIntResponseSerialization() {
    // Test that bigint values in responses are serialized with 'n' suffix
    const response = await this.request<{ id: string, value: string, name: string }>({
      context: { httpMethod: 'POST', path: '/test/bigint/model' },
      body: { id: '123n', value: '456n', name: 'test' }
    });

    assert(response.body);

    // BigInt values are serialized as strings with 'n' suffix in JSON
    assert.strictEqual(typeof response.body.id, 'bigint');
    assert.strictEqual(typeof response.body.value, 'bigint');
    assert.strictEqual(response.body.id, 123n);
    assert.strictEqual(response.body.value, 456n);
  }
}
