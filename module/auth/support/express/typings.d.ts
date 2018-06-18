import { AuthOperator } from './operator';

declare module "express" {
	export interface Request {
		auth: AuthOperator
	}
}
