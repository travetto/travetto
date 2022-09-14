import { Response, Request } from '../types';
import { RequestCore } from './internal/request';
import { ResponseCore } from './internal/response';

/**
 * Rest server utilities
 */
export class RestServerUtil {
  /**
   * Add base request as support for the provided
   * @param req Inbound request
   */
  static decorateRequest<T extends Request>(req: Partial<T> & Record<string, unknown>): T {
    delete req.redirect;
    Object.setPrototypeOf(req, RequestCore.prototype);
    req.path ??= (req.url ?? '').split(/[#?]/g)[0].replace(/^[^/]/, (a) => `/${a}`);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    req.method = req.method?.toUpperCase() as 'GET';
    // @ts-expect-error
    req.connection = {};

    if (!('files' in req)) { req.files = undefined; }
    if (!('auth' in req)) { req.auth = undefined; }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return req as T;
  }

  /**
   * Add base response as support for the provided
   * @param req Outbound response
   */
  static decorateResponse<T extends Response>(res: Partial<T> & Record<string, unknown>): T {
    Object.setPrototypeOf(res, ResponseCore.prototype);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return res as T;
  }

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
}