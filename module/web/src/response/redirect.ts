import { HttpSerializable } from './serializable';
import { HttpResponse } from '../types';

/**
 * Simple redirect response
 */
export class Redirect implements HttpSerializable {

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
    res.redirect(this.#status, this.#location);
  }
}