let cls = require('continuation-local-storage');

export const KEY = 'ctx';
export const NAMESPACE = 'encore';

export const Storage = cls.createNamespace(NAMESPACE);

export interface IStorage {
	set(key:string, value:any);
	get(key:string):any;
}

export class Context {
	static storage:IStorage = Storage;

	static clear() {
		Context.storage.set(KEY, null);
	}

	static set<T>(c: T) {
		Context.storage.set(KEY, c);
	}
	static get<T>(): T {
		let res = Context.storage.get(KEY) as T;
		if (res === null || res === undefined) {
			Context.set(res = {});
		}
		return res;
	}
}