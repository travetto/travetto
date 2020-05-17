import { Renderable } from './renderable';
import { Response } from '../types';

/**
 * Simple redirect response
 */
export class Redirect implements Renderable {

  /**
   * Build the redirect
   * @param location Location to redirect to
   * @param status Status code
   */
  constructor(private location: string, private status = 302) { }

  /**
   * Render the response
   */
  render(res: Response) {
    res.redirect(this.status, this.location);
  }
}