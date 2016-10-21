declare module Express {
	export interface Request {
		principal:{_id:string, groupMap:{[key:string]:boolean}};
		doLogout:()=>Promise<void>
	}	
}