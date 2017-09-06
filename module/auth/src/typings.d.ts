declare module Express {
	export interface Request {
		passportOptions: { failureRedirect?: string, successRedirect?: string };
		principal: { _id: string, groupSet: Set<string> };
		doLogout: () => Promise<void>
	}
}