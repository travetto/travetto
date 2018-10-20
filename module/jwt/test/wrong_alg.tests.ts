import * as assert from 'assert';
import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import { Suite, Test, ShouldThrow } from '@travetto/test';

const readFile = util.promisify(fs.readFile);

import * as jwt from '..';

const TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJmb28iOiJiYXIiLCJpYXQiOjE0MjY1NDY5MTl9.ETgkTn8BaxIX4YqvUWVFPmum3moNZ7oARZtSBXb_vP4';
const PUB_KEY = path.join(__dirname, 'pub.pem');

@Suite('when setting a wrong `header.alg`')
class BadAlgoSuite {

  @Test('signing with pub key as symmetric')
  @ShouldThrow('invalid algorithm')
  async testSymmetric() {
    const pub = await readFile(PUB_KEY, 'utf8');
    // priv is never used
    // var priv = fs.readFileSync(path.join(__dirname, 'priv.pem'));
    await jwt.verify(TOKEN, { key: pub });
  }

  @Test('signing with pub key as HS256 and whitelisting only RS256')
  @ShouldThrow('invalid algorithm')
  async testAsymmetric() {
    const pub = await readFile(PUB_KEY, 'utf8');

    await jwt.verify(TOKEN, { key: pub, alg: 'RS256' });
  }

  @Test('signing with HS256 and checking with HS384')
  @ShouldThrow('invalid signature')
  async testLength() {
    const token = await jwt.sign({ foo: 'bar' }, { key: 'secret', alg: 'HS256' });
    await jwt.verify(token, { key: 'some secret', alg: 'HS384' });
  }
}
