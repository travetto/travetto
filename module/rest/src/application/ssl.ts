import { AppError, CommonFileResourceProvider, Env } from '@travetto/base';
import { Config, EnvVar } from '@travetto/config';
import { Secret } from '@travetto/schema';

@Config('rest.ssl')
export class RestSslConfig {
  /**
   * Generate SSL key pair on demand
   * @param subj The subject for the app
   */
  static async generateSslKeyPair(subj = { C: 'US', ST: 'CA', O: 'TRAVETTO', OU: 'REST', CN: 'DEV' }): Promise<{ cert: string, key: string }> {
    let forge;

    try {
      forge = await import('node-forge');
    } catch {
      throw new Error('In order to generate SSL keys, you must install node-forge, "npm i --save-dev node-forge"');
    }

    const pki = forge.pki;

    const keys = pki.rsa.generateKeyPair(2048);
    const cert = pki.createCertificate();

    // fill the required fields
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    const attrs = [...Object.entries(subj)].map(([shortName, value]) => ({ shortName, value }));

    // here we set subject and issuer as the same one
    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // the actual certificate signing
    cert.sign(keys.privateKey);

    return {
      cert: pki.certificateToPem(cert),
      key: pki.privateKeyToPem(keys.privateKey)
    };
  }

  /**
   * Enabled
   */
  @EnvVar('REST_SSL')
  active: boolean = false;
  /**
   * SSL Keys
   */
  @Secret()
  keys?: {
    cert: string;
    key: string;
  };

  /**
   * Get SSL keys, will generate if missing, and in dev
   */
  async getKeys(): Promise<{
    key: string;
    cert: string;
  } | undefined> {
    if (!this.active) {
      return;
    }
    if (!this.keys) {
      if (Env.isProd()) {
        throw new AppError('Cannot use test keys in production', 'permissions');
      }
      return RestSslConfig.generateSslKeyPair();
    } else {
      if (this.keys.key.length < 100) {
        const provider = new CommonFileResourceProvider();
        this.keys.key = (await provider.read(this.keys.key, true)).toString('utf8');
        this.keys.cert = (await provider.read(this.keys.cert, true)).toString('utf8');
      }
      return this.keys;
    }
  }
}
