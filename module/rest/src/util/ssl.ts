import { CommandService } from '@travetto/exec';

export class SSLUtil {

  static ssl = new CommandService({
    containerImage: 'jordi/openssl',
    localCheck: ['openssl', ['help']]
  });

  static async generateKeyPair(subj: string) {

    const res = await this.ssl.run('openssl', 'req',
      '-new',
      '-newkey', 'rsa:2048',
      '-sha256',
      '-days', '3650',
      '-nodes',
      '-x509',
      '-keyout', '-',
      '-out', '-',
      '-subj', subj
    );

    const lines = res.stdout.split('\n');
    const sep = lines.findIndex(x => x === '-----BEGIN CERTIFICATE-----');
    const key = lines.slice(0, sep).join('\n').trim();
    const cert = lines.slice(sep).join('\n').trim();

    return { cert, key };
  }
}