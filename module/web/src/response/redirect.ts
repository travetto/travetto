import { HttpSerializable } from './serializable.ts';
import { HttpPayload } from '../types.ts';

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
   */
  serialize(): HttpPayload {
    return {
      statusCode: this.#status,
      headers: { Location: this.#location },
      data: Buffer.from([])
    };
  }
}