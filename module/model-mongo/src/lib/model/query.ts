import * as mongo from "mongodb";

export interface QueryOptions {
  sort?:({[key:string]: number}|string|string[])
  limit?:number,
  offset?:number
}