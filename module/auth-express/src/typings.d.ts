import { Class } from '@travetto/registry';
import { AuthServiceAdapter } from './service-adapter';

declare module "express" {
	export interface Request {
		auth: AuthServiceAdapter;
	}
}
