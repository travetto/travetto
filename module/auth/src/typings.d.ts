
declare module Express {
	export interface AuthContext<T = any> {
		id: string;
		permissions: Set<string>;
		principal: T;
	}

	export interface AuthOperator<T> {
		context: AuthContext<T>;
		unauthenticated: boolean;

		login(req: Request, res: Response): Promise<T>;
		logout(req: Request, res: Response): Promise<void>;
		register?(req: Request, res: Response, user: T): Promise<T>;
		changePassword?(req: Request, res: Response, userId: string, password: string, oldpassword: string): Promise<T>;
	}

	export interface Request {
		auth: AuthOperator<any>
	}
}
