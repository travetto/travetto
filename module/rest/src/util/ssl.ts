export class SSLUtil {

  static async generateKeyPair(subj = { C: 'US', ST: 'CA', O: 'TRAVETTO', OU: 'REST', CN: 'DEV' }) {
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
    cert.sign(keys.privateKey, undefined as any);

    return {
      cert: pki.certificateToPem(cert),
      key: pki.privateKeyToPem(keys.privateKey)
    };
  }
}