import { Response } from 'express';
import { Renderable } from './renderable';

export class Redirect implements Renderable {

  constructor(private location: string, private status = 302) {
  }

  render(res: Response) {
    res.status(this.status);
    res.location(this.location);
  }
}