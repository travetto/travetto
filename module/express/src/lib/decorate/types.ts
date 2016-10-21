import {Request,Response,NextFunction} from "express";

export type PathType = string|RegExp
export interface RequestHandler { 
	method? : string, 
	path? : PathType,
	headers? : {[key:string]:(string|(()=>string))}	
}
export interface FilterPromise {
	(req:Request, res:Response):Promise<any>
} 
export interface FilterSync{
	(req:Request, res:Response, next?:NextFunction):any
}
export type Filter = FilterPromise|FilterSync;

