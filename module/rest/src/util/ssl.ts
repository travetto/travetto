import * as cp from 'child_process';
import * as util from 'util';
const exec = util.promisify(cp.exec);

export class SSLUtil {
  static async generateKeyPair() {
    const { stdout } = await exec('openssl req -nodes -new -x509 -keyout /dev/stdout -out /dev/stdout -subj "/C=WR/ST=STATE/O=TRAVETTO/OU=REST/CN=DEV-APP"');
    const lines = stdout.toString().split('\n');
    const sep = lines.findIndex(x => x === '-----BEGIN CERTIFICATE-----');
    const key = lines.slice(0, sep).join('\n');
    const cert = lines.slice(sep).join('\n');

    return { cert, key };
  }
}