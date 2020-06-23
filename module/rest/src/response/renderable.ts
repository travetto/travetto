import { Response } from '../types';

/**
 * Renderable contract
 */
export interface Renderable {
  /**
   * Render the output given a response
   * @param res
   */
  render(res: Response): void;
}