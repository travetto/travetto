import * as assert from 'assert';
import { Suite, Test, ShouldThrow, BeforeEach } from '@travetto/test';

import * as jwt from '..';

@Suite('Audience - Signing with a string for aud')
class AudSignStringSuite {
  private token: string;

  @BeforeEach()
  async init() {
    this.token = await jwt.sign({ aud: 'urn:foo' }, { alg: 'none' });
  }

  @Test('should verify and decode without verify "audience" option')
  async testDecodeVerifyWithout() {
    const decoded = jwt.decode(this.token);
    const verified = await jwt.verify(this.token);

    assert.deepEqual(decoded, verified);
    assert(decoded.aud === 'urn:foo');
  }

  @Test('should verify with a string "verify.audience" option')
  async testAudStringOption() {
    assert(await jwt.verify(this.token, { payload: { aud: 'urn:foo' } }));
  }

  @Test('should verify with an array of strings "verify.audience" option')
  async testAudStrings() {
    assert(await jwt.verify(this.token, { payload: { aud: ['urn:no_match', 'urn:foo'] } }));
  }

  @Test('should verify with a Regex "verify.audience" option')
  async testregex() {
    assert(await jwt.verify(this.token, { payload: { aud: /^urn:f[o]{2}$/ } }));
  }

  @Test('should verify with an array of Regex "verify.audience" option')
  async testRegexArray() {
    assert(await jwt.verify(this.token, { payload: { aud: [/^urn:no_match$/, /^urn:f[o]{2}$/] } }));
  }

  @Test('should verify with an array containing a string and a Regex "verify.audience" option')
  async testMix() {
    assert(await jwt.verify(this.token, { payload: { aud: ['urn:no_match', /^urn:f[o]{2}$/] } }));
  }

  @Test('invalid audiience')
  @ShouldThrow(jwt.JWTError)
  async testinvalidAud() {
    await jwt.verify(this.token, { payload: { aud: 'urn:no-match' } });
  }

  @Test('should error on no match with an array of string "verify.audience" option')
  @ShouldThrow(jwt.JWTError)
  async testInvalidArray() {
    await jwt.verify(this.token, { payload: { aud: ['urn:no-match-1', 'urn:no-match-2'] } });
  }

  @Test('should error on no match with a Regex "verify.audience" option')
  @ShouldThrow(jwt.JWTError)
  async testInvalidRegx() {
    await jwt.verify(this.token, { payload: { aud: /^urn:no-match$/ } });
  }
}

@Suite('Audience - Signing with a string[] for aud')
class AudSignStringArraySuite {
  private token: string;

  @BeforeEach()
  async init() {
    this.token = await jwt.sign({ aud: ['urn:foo', 'urn:bar'] }, { alg: 'none' });
  }

  @Test('should verify and decode without verify "audience" option')
  async testSingle() {
    const decoded = jwt.decode(this.token);
    const verified = await jwt.verify(this.token, { alg: 'none' });

    assert.deepEqual(decoded, verified);
    assert(decoded.aud === ['urn:foo', 'urn:bar']);
  }

  @Test('should error on no match with a string "verify.audience" option')
  @ShouldThrow(jwt.JWTError)
  async testNoMatch() {
    await jwt.verify(this.token, { payload: { aud: 'urn:no-match' } });
  }

  @Test('should error on no match with an array of string "verify.audience" option')
  @ShouldThrow(jwt.JWTError)
  async testArray() {
    await jwt.verify(this.token, {
      payload: { aud: ['urn:no-match-1', 'urn:no-match-2'] }
    });
  }

  @Test('should error on no match with a Regex "verify.audience" option')
  @ShouldThrow(jwt.JWTError)
  async testRegex() {
    await jwt.verify(this.token, {
      payload: { aud: /^urn:no-match$/ }
    });
  }

  @Test('should verify with an array of stings "verify.audience" option')
  async testMultiMatch() {
    await jwt.verify(this.token, {
      payload: { aud: ['urn:foo', 'urn:bar'] }
    });
  }

  @Test('should verify with a Regex "verify.audience" option')
  async testMulti() {
    await jwt.verify(this.token, {
      payload: { aud: /^urn:[a-z]{3}$/ }
    });
  }

  @Test('should verify with an array of Regex "verify.audience" option')
  async testMultiArray() {
    await jwt.verify(this.token, {
      payload: {
        aud: [/^urn:f[o]{2}$/, /^urn:b[ar]{2}$/]
      }
    });
  }
}

@Suite('Audience - Signing without a payload')
class AudSignEmptySuite {
  private token: string;

  @BeforeEach()
  async init() {
    this.token = await jwt.sign({}, { alg: 'none' });
  }

  @Test('should verify and decode without verify "audience" option')
  async testDecodeWithout() {
    const decoded = jwt.decode(this.token);
    const verified = await jwt.verify(this.token);

    assert.deepEqual(decoded, verified);
    assert(decoded.aud === undefined);
  }

  @Test('should error on no match with a string "verify.audience" option')
  @ShouldThrow(jwt.JWTError)
  async testString() {
    await jwt.verify(this.token, {
      payload: {
        aud: 'urn:no-match'
      }
    });
  }

  @Test('should error on no match with an array of string "verify.audience" option')
  @ShouldThrow(jwt.JWTError)
  async test() {
    await jwt.verify(this.token, {
      payload: {
        aud: ['urn:no-match-1', 'urn:no-match-2']
      }
    });
  }

  @Test('should error on no match with a Regex "verify.audience" option')
  @ShouldThrow(jwt.JWTError)
  async testSingle() {
    await jwt.verify(this.token, {
      payload: {
        aud: /^urn:no-match$/
      }
    });
  }

  @Test('should error on no match with an array of a Regex and a string in "verify.audience" option')
  @ShouldThrow(jwt.JWTError)
  async testNoMatch() {
    await jwt.verify(this.token, {
      payload: {
        aud: [/^urn:no-match$/, 'urn:no-match']
      }
    });
  }
}
