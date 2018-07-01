import { Class } from '@travetto/registry';
import { AuthService } from '@travetto/auth';

declare module "express" {
	export interface Request {
		auth: AuthService
		doLogin(providers: symbol[]): Promise<any>;
	}
}
