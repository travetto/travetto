import { Asset } from '@travetto/asset';

declare global {
	namespace Travetto {
		interface Request {
			files: { [key: string]: Asset };
		}
	}
}