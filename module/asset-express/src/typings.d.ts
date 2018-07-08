import { Asset } from '@travetto/asset';

declare module 'express' {
	export interface Request {
		files: { [key: string]: Asset };
	}
}