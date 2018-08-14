import { Response } from 'express';

export interface Renderable {
  render(res: Response): Promise<any>;
}

export function isRenderable(o: any): o is Renderable {
  return !!o['render'];
}