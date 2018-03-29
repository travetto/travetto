import { ModelCore } from '../model';

export type Point = [number, number];

export type FieldType = string | number | Date | Point | boolean | ModelCore;

export type ValidFieldNames<T> = { [K in keyof T]: T[K] extends FieldType ? K : never }[keyof T];

const HIDDEN = Symbol('hidden')

export type RetainFields<T> = T extends { [HIDDEN]?: any } ? T : (Pick<T, ValidFieldNames<T>> & { [HIDDEN]?: any });
