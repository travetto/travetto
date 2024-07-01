import { Response } from '../types';

/**
 * Renderable contract
 */
export interface Renderable {

  /**
   * Get additional headers if specified
   */
  headers?(): Record<string, string>;

  /**
   * Set the status code if specified
   */
  statusCode?(): number;

  /**
   * Render the output given a response.  If it returns a value, that is sent to the client
   * @param res
   */
  render(res: Response): unknown;
}