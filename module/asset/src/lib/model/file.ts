import {Request,Response} from "express";
import {Renderable} from '@encore/express';
import {nodeToPromise} from '@encore/util';
import * as fs from "fs";
import * as mime from "mime"; 

export class File extends Renderable {
	
	static fields = ['filename', 'length','contentType','path','metadata','stream'];
	
	_id:string;
	stream:NodeJS.ReadableStream;
	length:number;
	filename:string;
	contentType:string;
	path:string;
	metadata : {
		name : string,
		title : string,
		hash : string,
		createdDate : Date,
		tags?: string[]
	}
	
	constructor(conf:any = null) {
		super();
		if (conf) {
			File.fields.forEach(k => {
				if (conf[k]) (this as any)[k] = conf[k]
			})
		}
	}
		
	render(res:Response) {
    res.setHeader('Content-Type', this.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${this.filename}"`)
		if (this.length) {
			res.setHeader('Content-Length', `${this.length}`);
		}
		if (this.stream) {
			this.stream.pipe(res);
		}
		
		return new Promise<any>((resolve, reject) => {
			this.stream.on('end', resolve);
			this.stream.on('error', reject);
		});
	}
	
	async read() {
		let res = (await nodeToPromise<Buffer>(fs, fs.readFile, this.path)).toString();
		fs.unlink(this.path);
		return res;
	}
}