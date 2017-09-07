import { Asset } from '@encore2/asset';

declare module 'express' {
	export interface Request {
		files: { [key: string]: Asset };
	}
}