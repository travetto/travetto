import { Renderable } from './renderable';
import { Response } from '../types';

export class StringResponse implements Renderable {
  constructor(public content: string, private status: number = 200) {
  }

  render(res: Response): void {
    res.status(this.status);
    res.send(this.content);
  }
}