import { Response } from 'express';

export interface Renderable {
  render(res: Response): any;
}