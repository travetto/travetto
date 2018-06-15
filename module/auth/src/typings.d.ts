declare module Express {
	export interface Request {
		logout: () => Promise<void>;
		principal: {
			id: string;
			permissions: Set<string>;
			full: any;
		};
	}
}
