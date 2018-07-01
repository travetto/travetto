import { Class } from '@travetto/registry';
import { AuthService } from '../../src';

declare module "express" {
	export interface Request {
		auth: AuthService
		doLogin(providers: symbol[]): Promise<any>;
	}
}
