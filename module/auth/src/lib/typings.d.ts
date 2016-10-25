declare module Express {
	export interface Request {
		passportOptions: { failureRedirect?: string, successRedirect?: string };
		principal: { _id: string, groupMap: { [key: string]: boolean } };
		doLogout: () => Promise<void>
	}
}