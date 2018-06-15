declare module Express {
	export interface Auth<T = any> {
		unauthenticated: boolean;
		logout(req: Request, res: Response): Promise<void>;
		login(req: Request, res: Response): Promise<T>;
		register?(req: Request, res: Response, user: T): Promise<T>;
		changePassword?(req: Request, res: Response, userId: string, password: string, oldPassword?: string): Promise<T>;
		context: AuthContext<T>;
	}

	export interface AuthContext<T = any> {
		id: string;
		permissions: Set<string>;
		principal: T;
	}

	export interface Request {
		auth: Auth;
	}
}
