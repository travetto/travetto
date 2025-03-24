import { HttpSerializable } from './serializable.ts';
import { HttpPayload } from '../types.ts';

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
   */
  serialize(): HttpPayload {
    return new HttpPayload({
      statusCode: this.#status,
      source: this,
      headers: { Location: this.#location },
      output: Buffer.from([])
    });
  }
}