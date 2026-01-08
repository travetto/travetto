import { PackageUtil } from '@travetto/manifest';
import { Runtime } from '@travetto/runtime';

import type { WebSecureKeyPair } from './types.ts';

/**
 * Utils for generating key pairs
 */
export class WebTlsUtil {

  /**
   * Generate TLS key pair on demand
   * @param subj The subject for the app
   */
  static async generateKeyPair(subj = { C: 'US', ST: 'CA', O: 'TRAVETTO', OU: 'WEB', CN: 'DEV' }): Promise<WebSecureKeyPair> {
    let forge;

    try {
      forge = (await import('node-forge')).default;
    } catch {
      const install = PackageUtil.getInstallCommand(Runtime, 'node-forge');
      throw new Error(`In order to generate TLS keys, you must install node-forge, "${install}"`);
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

    const attrs = Object.entries(subj).map(([shortName, value]) => ({ shortName, value }));

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
}