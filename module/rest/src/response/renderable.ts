import { Response } from '../types';

// TODO: Document
export interface Renderable {
  render(res: Response): void | Promise<any>;
}

// TODO: Document
export function isRenderable(o: any): o is Renderable {
  return !!o['render'];
}