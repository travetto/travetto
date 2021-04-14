import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { JWTUtil } from '..';

const noneAlgorithmHeader = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0';

@Suite('issue at')
class IssueAtSuite {

  @Test('`jwt.sign` "iat" claim validation')
  async testValidation() {
    for (const val of [
      true,
      false,
      null,
      undefined,
      '',
      'invalid',
      [],
      ['foo'],
      {},
      { foo: 'bar' },
    ]) {
      const token = `${noneAlgorithmHeader}.${Buffer.from(JSON.stringify({ iat: val })).toString('base64')}.`;
      await assert.rejects(async () => JWTUtil.verify(token), 'invalid');
    }
  }

  @Test('when signing a token')
  async testCases() {
    const now = Math.trunc(Date.now() / 1000);
    const OPS = [
      {
        desc: 'should default to current time for "iat"',
        iat: 60,
        expectedIssueAt: 60,
        iatExclude: false
      },
      {
        desc: 'should sign with provided time for "iat"',
        iat: 100,
        expectedIssueAt: 100,
        iatExclude: false
      },
      {
        desc: 'should remove default "iat" with "noTimestamp" option',
        iat: undefined,
        expectedIssueAt: undefined,
        iatExclude: true
      },
      {
        desc: 'should remove provided "iat" with "noTimestamp" option',
        iat: undefined,
        expectedIssueAt: undefined,
        iatExclude: true
      },
    ];

    for (const testCase of OPS) {
      const token = await JWTUtil.create({ iat: now + (testCase.iat! || 0) }, { iatExclude: testCase.iatExclude });
      if (!testCase.expectedIssueAt) {
        assert(JWTUtil.read(token).payload.iat === undefined);
      } else {
        assert(JWTUtil.read(token).payload.iat === now + testCase.expectedIssueAt);
      }
    }
  }

  @Test('verify token')
  async verifyToken() {
    const OPS = [
      {
        desc: 'should verify using "iat" before the "maxAge"',
        clockTimestamp: 10,
        maxAge: 11,
        options: {},
      },
      {
        desc: 'should verify using "iat" before the "maxAge" with a provided "clockTimestamp',
        maxAge: 11,
        clockTimestamp: 10,
      },
      {
        desc: 'should verify using "iat" after the "maxAge" but within "clockTolerance"',
        maxAge: 9,
        clockTimestamp: 8,
      },
    ];

    const NOW = Math.trunc(Date.now() / 1000);

    for (const testCase of OPS) {
      const token = await JWTUtil.create({ exp: NOW + testCase.maxAge }, {
        key: 'secret',
        alg: 'none'
      });
      await JWTUtil.verify(token, {
        clock: {
          timestamp: NOW + (testCase.clockTimestamp || 0)
        },
      });

      assert(token);
    }
  }

  @Test('verify expire')
  async verifyExpire() {
    const OPS = [
      {
        desc: 'should throw using "iat" equal to the "maxAge"',
        clockAdvance: 10,
        maxAge: 10
      },
      {
        desc: 'should throw using "iat" after the "maxAge"',
        clockAdvance: 10,
        maxAge: 9,
      },
      {
        desc: 'should throw using "iat" after the "maxAge" with a provided "clockTimestamp',
        clockAdvance: 60,
        maxAge: 10,
      },
      {
        desc: 'should throw using "iat" after the "maxAge" and "clockTolerance',
        clockAdvance: 10,
        maxAge: 8,
        clockTolerance: 2,
      },
    ];

    const NOW = Math.trunc(Date.now() / 1000);

    for (const testCase of OPS) {
      const token = await JWTUtil.create({ iat: NOW }, { key: 'secret', alg: 'none' });
      await assert.rejects(
        async () => JWTUtil.verify(token, {
          maxAgeSec: testCase.maxAge,
          clock: {
            tolerance: (testCase.clockTolerance || 0),
            timestamp: NOW + testCase.clockAdvance
          }
        }),
        'maxAge exceeded');
    }
  }
}