import { Request, Response } from "express";
import Config from '../config';

let cls = require('continuation-local-storage');
export const KEY = 'ctx';

export const Storage = cls.createNamespace(Config.context);

export interface ContextEntry {
	req?: Request,
	res?: Response
}

export class Context {
	static clear() {
		Storage.set(KEY, null);
	}

	static set(c: ContextEntry & any) {
		Storage.set(KEY, c);
	}
	static get(): ContextEntry & any {
		let res = Storage.get(KEY) as ContextEntry;
		if (res === null || res === undefined) {
			Context.set(res = {});
		}
		return res;
	}
}