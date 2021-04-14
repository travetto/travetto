import { Suite, Test, ShouldThrow } from '@travetto/test';
import { JWTUtil, JWTError } from '..';

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M';

@Suite('verifying without specified secret or public key')
class MissingKeySuite {
  @Test('should not verify undefined')
  @ShouldThrow(JWTError)
  async testMissing() {
    await JWTUtil.verify(TOKEN);
  }
}