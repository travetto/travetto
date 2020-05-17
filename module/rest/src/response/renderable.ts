import { Response } from '../types';

/**
 * Renderable contract
 */
export interface Renderable {
  /**
   * Render the output given a response
   * @param res
   */
  render(res: Response): void | Promise<any>;
}

/**
 * Determine if an object is renderable
 */
export function isRenderable(o: any): o is Renderable {
  return !!o['render'];
}