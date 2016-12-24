declare module NodeJS {
	export interface Console {
		debug: (msg?: string, ...extra: any[]) => void
	}
}