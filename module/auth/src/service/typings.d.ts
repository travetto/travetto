import { AuthService } from './auth';

declare module "express" {
	export interface Request {
		auth: AuthService<any>
	}
}
