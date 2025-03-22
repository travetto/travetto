import { HttpSerializable } from './serializable.ts';
import { HttpResponse } from '../types.ts';

/**
 * Simple redirect response
 */
export class Redirect implements HttpSerializable<void> {

  #location: string;
  #status: number;

  /**
   * Build the redirect
   * @param location Location to redirect to
   * @param status Status code
   */
  constructor(location: string, status = 302) {
    this.#location = location;
    this.#status = status;
  }

  /**
   * Render the response
   * @returns {void}
   */
  serialize(res: HttpResponse): void {
    res.redirect(this.#location, this.#status);
  }
}