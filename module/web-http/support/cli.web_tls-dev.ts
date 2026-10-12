import { spawn } from 'node:child_process';

import { CliCommand } from '@travetto/cli';
import { ExecUtil, Runtime } from '@travetto/runtime';

/**
 * Generate a self-signed TLS certificate and private key for local development.
 *
 * Uses OpenSSL to create localhost certificate and key files in the workspace
 * resources directory for local HTTPS development.
 */
@CliCommand()
export class CliWebTlsDev {
  keyFile = 'resources/localhost-key.pem';
  certFile = 'resources/localhost-cert.pem';

  async main() {
    const sslProc = spawn(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-sha256',
        '-days',
        '365',
        '-subj',
        '/C=US/O=TRAVETTO/CN=LOCALHOST',
        '-keyout',
        Runtime.workspaceRelative(this.keyFile),
        '-out',
        Runtime.workspaceRelative(this.certFile)
      ],
      {}
    );
    const result = await ExecUtil.getResult(sslProc, { catch: true });
    if (!result.valid) {
      console.error('Failed to properly generate the TLS certificate');
      console.error(result.stderr || result.stdout);
      process.exitCode = 1;
    }
  }
}
