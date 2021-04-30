import { Response } from '../types';

/**
 * Renderable contract
 */
export interface Renderable {
  /**
   * Render the output given a response.  If it returns a value, that is sent to the client
   * @param res
   */
  render(res: Response): unknown;
}