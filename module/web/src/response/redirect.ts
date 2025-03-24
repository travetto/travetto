import { HttpSerializable, HttpPayload } from './payload.ts';

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
  serialize(): HttpPayload<void> {
    return HttpPayload.fromEmpty().with({
      statusCode: this.#status,
      headers: { Location: this.#location },
    });
  }
}