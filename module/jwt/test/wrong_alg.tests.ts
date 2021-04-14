import { Suite, Test, ShouldThrow } from '@travetto/test';
import { ResourceManager } from '@travetto/base';

import { JWTUtil } from '..';

const TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJmb28iOiJiYXIiLCJpYXQiOjE0MjY1NDY5MTl9.ETgkTn8BaxIX4YqvUWVFPmum3moNZ7oARZtSBXb_vP4';

@Suite('when setting a wrong `header.alg`')
class BadAlgoSuite {

  @Test('signing with pub key as symmetric')
  @ShouldThrow('invalid algorithm')
  async testSymmetric() {
    const pub = await ResourceManager.read('/pub.pem', 'utf8');
    await JWTUtil.verify(TOKEN, { key: pub });
  }

  @Test('signing with pub key as HS256 and whitelisting only RS256')
  @ShouldThrow('invalid algorithm')
  async testAsymmetric() {
    const pub = await ResourceManager.read('/pub.pem', 'utf8');

    await JWTUtil.verify(TOKEN, { key: pub, alg: 'RS256' });
  }

  @Test('signing with HS256 and checking with HS384')
  @ShouldThrow('invalid signature')
  async testLength() {
    const token = await JWTUtil.create({ foo: 'bar' }, { key: 'secret', alg: 'HS256' });
    await JWTUtil.verify(token, { key: 'some secret', alg: 'HS384' });
  }
}
