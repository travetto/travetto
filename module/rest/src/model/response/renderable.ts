import { Response } from '../../types';

export interface Renderable {
  render(res: Response): void | Promise<any>;
}

export function isRenderable(o: any): o is Renderable {
  return !!o['render'];
}