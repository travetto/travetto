import * as assert from 'assert';
import { Suite, Test, ShouldThrow, BeforeEach } from '@travetto/test';

import { JWTUtil } from '..';
import { JWTError } from '../src/error';

@Suite('Audience - Signing with a string for aud')
class AudSignStringSuite {
  #token: string;

  @BeforeEach()
  async init() {
    this.#token = await JWTUtil.create({ aud: 'urn:foo' }, { alg: 'none' });
  }

  @Test('should verify and decode without verify "audience" option')
  async testDecodeVerifyWithout() {
    const { payload: decoded } = JWTUtil.read(this.#token);
    const verified = await JWTUtil.verify(this.#token);

    assert.deepEqual(decoded, verified);
    assert(decoded.aud === 'urn:foo');
  }

  @Test('should verify with a string "verify.audience" option')
  async testAudStringOption() {
    assert(await JWTUtil.verify(this.#token, { payload: { aud: 'urn:foo' } }));
  }

  @Test('should verify with an array of strings "verify.audience" option')
  async testAudStrings() {
    assert(await JWTUtil.verify(this.#token, { payload: { aud: ['urn:no_match', 'urn:foo'] } }));
  }

  @Test('should verify with a Regex "verify.audience" option')
  async testRegex() {
    assert(await JWTUtil.verify(this.#token, { payload: { aud: /^urn:f[o]{2}$/ } }));
  }

  @Test('should verify with an array of Regex "verify.audience" option')
  async testRegexArray() {
    assert(await JWTUtil.verify(this.#token, { payload: { aud: [/^urn:no_match$/, /^urn:f[o]{2}$/] } }));
  }

  @Test('should verify with an array containing a string and a Regex "verify.audience" option')
  async testMix() {
    assert(await JWTUtil.verify(this.#token, { payload: { aud: ['urn:no_match', /^urn:f[o]{2}$/] } }));
  }

  @Test('invalid audience')
  @ShouldThrow(JWTError)
  async testInvalidAud() {
    await JWTUtil.verify(this.#token, { payload: { aud: 'urn:no-match' } });
  }

  @Test('should error on no match with an array of string "verify.audience" option')
  @ShouldThrow(JWTError)
  async testInvalidArray() {
    await JWTUtil.verify(this.#token, { payload: { aud: ['urn:no-match-1', 'urn:no-match-2'] } });
  }

  @Test('should error on no match with a Regex "verify.audience" option')
  @ShouldThrow(JWTError)
  async testInvalidRegex() {
    await JWTUtil.verify(this.#token, { payload: { aud: /^urn:no-match$/ } });
  }
}

@Suite('Audience - Signing with a string[] for aud')
class AudSignStringArraySuite {
  #token: string;

  @BeforeEach()
  async init() {
    this.#token = await JWTUtil.create({ aud: ['urn:foo', 'urn:bar'] }, { alg: 'none' });
  }

  @Test('should verify and decode without verify "audience" option')
  async testSingle() {
    const { payload: decoded } = JWTUtil.read(this.#token);
    const verified = await JWTUtil.verify(this.#token, { alg: 'none' });

    assert.deepEqual(decoded, verified);
    assert(decoded.aud === ['urn:foo', 'urn:bar']);
  }

  @Test('should error on no match with a string "verify.audience" option')
  @ShouldThrow(JWTError)
  async testNoMatch() {
    await JWTUtil.verify(this.#token, { payload: { aud: 'urn:no-match' } });
  }

  @Test('should error on no match with an array of string "verify.audience" option')
  @ShouldThrow(JWTError)
  async testArray() {
    await JWTUtil.verify(this.#token, {
      payload: { aud: ['urn:no-match-1', 'urn:no-match-2'] }
    });
  }

  @Test('should error on no match with a Regex "verify.audience" option')
  @ShouldThrow(JWTError)
  async testRegex() {
    await JWTUtil.verify(this.#token, {
      payload: { aud: /^urn:no-match$/ }
    });
  }

  @Test('should verify with an array of stings "verify.audience" option')
  async testMultiMatch() {
    await JWTUtil.verify(this.#token, {
      payload: { aud: ['urn:foo', 'urn:bar'] }
    });
  }

  @Test('should verify with a Regex "verify.audience" option')
  async testMulti() {
    await JWTUtil.verify(this.#token, {
      payload: { aud: /^urn:[a-z]{3}$/ }
    });
  }

  @Test('should verify with an array of Regex "verify.audience" option')
  async testMultiArray() {
    await JWTUtil.verify(this.#token, {
      payload: {
        aud: [/^urn:f[o]{2}$/, /^urn:b[ar]{2}$/]
      }
    });
  }
}

@Suite('Audience - Signing without a payload')
class AudSignEmptySuite {
  #token: string;

  @BeforeEach()
  async init() {
    this.#token = await JWTUtil.create({}, { alg: 'none' });
  }

  @Test('should verify and decode without verify "audience" option')
  async testDecodeWithout() {
    const { payload: decoded } = JWTUtil.read(this.#token);
    const verified = await JWTUtil.verify(this.#token);

    assert.deepEqual(decoded, verified);
    assert(decoded.aud === undefined);
  }

  @Test('should error on no match with a string "verify.audience" option')
  @ShouldThrow(JWTError)
  async testString() {
    await JWTUtil.verify(this.#token, {
      payload: {
        aud: 'urn:no-match'
      }
    });
  }

  @Test('should error on no match with an array of string "verify.audience" option')
  @ShouldThrow(JWTError)
  async test() {
    await JWTUtil.verify(this.#token, {
      payload: {
        aud: ['urn:no-match-1', 'urn:no-match-2']
      }
    });
  }

  @Test('should error on no match with a Regex "verify.audience" option')
  @ShouldThrow(JWTError)
  async testSingle() {
    await JWTUtil.verify(this.#token, {
      payload: {
        aud: /^urn:no-match$/
      }
    });
  }

  @Test('should error on no match with an array of a Regex and a string in "verify.audience" option')
  @ShouldThrow(JWTError)
  async testNoMatch() {
    await JWTUtil.verify(this.#token, {
      payload: {
        aud: [/^urn:no-match$/, 'urn:no-match']
      }
    });
  }
}
