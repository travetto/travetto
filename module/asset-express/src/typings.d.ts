import { Asset } from '@encore/asset';

declare module 'express' {
	export interface Request {
		files: { [key: string]: Asset };
	}
}