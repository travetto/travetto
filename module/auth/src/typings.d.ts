import { AuthOperator } from './service/auth';

declare module "express" {
	export interface Request {
		auth: AuthOperator<any>
	}
}
