import { Response } from 'express';

export interface Renderable {
  render(res: Response): any;
}

export class Redirect implements Renderable {

  constructor(private location: string, private status = 302) {
  }

  render(res: Response) {
    res.status(this.status).location(this.location);
  }
}