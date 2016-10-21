import {Response} from "express"; 

import {nodeToPromise} from '../../util';

export abstract class Renderable {
	abstract render(res:Response):any;
}

export class Redirect extends Renderable {
	
	constructor(private location:string, private status:number = 302) {
		super()
	}
	
	render(res:Response) {
		res.status(this.status).location(this.location);
	}
}