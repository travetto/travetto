declare module Express {
	export interface Session {
		destroy: () => void
	}

	export interface Request {
		session: Session
	}
}