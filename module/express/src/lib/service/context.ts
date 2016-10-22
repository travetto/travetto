import { Request, Response } from "express";
import Config from '../config';

let cls = require('continuation-local-storage');
export const KEY = 'ctx';

export const Storage = cls.createNamespace(Config.context);

export interface ContextEntry {
	req?: Request,
	res?: Response
}

export interface IStorage {
	set(key:string, value:any);
	get(key:string):any;
}

export class Context {
	static storage:IStorage = Storage;

	static clear() {
		Context.storage.set(KEY, null);
	}

	static set(c: ContextEntry & any) {
		Context.storage.set(KEY, c);
	}
	static get(): ContextEntry & any {
		let res = Context.storage.get(KEY) as ContextEntry;
		if (res === null || res === undefined) {
			Context.set(res = {});
		}
		return res;
	}
}