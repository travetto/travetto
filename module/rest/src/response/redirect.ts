import { Renderable } from './renderable.ts';
import { Response } from '../types.ts';

/**
 * Simple redirect response
 */
export class Redirect implements Renderable {

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
  render(res: Response): void {
    res.redirect(this.#status, this.#location);
  }
}