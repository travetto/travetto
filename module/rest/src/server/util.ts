import { Response, Request } from '../types';

/**
 * Base response object
 */
abstract class BaseResponse implements Partial<Response> {
  /**
   * Produce JSON as the output
   */
  json(this: Response, val: any) {
    this.setHeader('Content-Type', 'application/json');
    this.send(val);
  }
  /**
   * Get the status code
   */
  // @ts-ignore
  get statusCode(this: Response): number {
    return this.status!() as number;
  }
  /**
   * Set the status code
   */
  // @ts-ignore
  set statusCode(this: Response, val: number) {
    this.status(val);
  }

  /**
   * Send the request to a new location, given a path
   */
  location(this: Response, path: string) {

    if (!this.statusCode) {
      this.status(302);
    }

    this.setHeader('Location', path);
  }

  /**
   * Redirect application to a new path
   * @param code The HTTP code to send
   * @param path The new location for the request
   */
  redirect(this: Response & BaseResponse, code: number, path: string): void;
  redirect(this: Response & BaseResponse, path: string): void;
  redirect(this: Response & BaseResponse, pathOrCode: number | string, path?: string) {
    let code = 302;
    if (path) {
      code = pathOrCode as number;
    } else {
      path = pathOrCode as string;
    }
    this.status(code);
    this.location(path!);
    this.setHeader('Content-Length', '0');
    this.send('');
  }
}

/**
 * Base Request object
 */
abstract class BaseRequest implements Partial<Request> {
  /**
   * Get the outbound response header
   * @param key The header to get
   */
  header(this: Request, key: string) {
    return this.headers![key.toLowerCase()] as string;
  }
}

/**
 * Rest server utilities
 */
export class RestServerUtil {
  /**
   * Add base request as support for the provided
   * @param req Inbound request
   */
  static decorateRequest<T extends Request>(req: Partial<T> & Record<string, any>): T {
    delete req.redirect;
    Object.setPrototypeOf(req, BaseRequest.prototype);
    req.url = req.path;
    // @ts-ignore
    req.connection = {};
    return req as T;
  }

  /**
   * Add base response as support for the provided
   * @param req Outbound response
   */
  static decorateResponse<T extends Response>(res: Partial<T> & Record<string, any>): T {
    Object.setPrototypeOf(res, BaseResponse.prototype);
    return res as T;
  }

  /**
   * Generate SSL key pair on demand
   * @param subj The subject for the app
   */
  static async generateSslKeyPair(subj = { C: 'US', ST: 'CA', O: 'TRAVETTO', OU: 'REST', CN: 'DEV' }) {
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