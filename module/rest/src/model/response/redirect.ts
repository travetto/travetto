import { Renderable } from './renderable';
import { Response } from '../../types';

export class Redirect implements Renderable {

  constructor(private location: string, private status = 302) {
  }

  render(res: Response) {
    res.redirect(this.status, this.location);
  }
}