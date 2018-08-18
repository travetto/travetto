import { Asset } from '@travetto/asset';

declare module '@travetto/rest/io' {
	export interface Request {
		files: { [key: string]: Asset };
	}
}