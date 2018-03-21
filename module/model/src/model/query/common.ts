import { ModelCore } from '../model';

export type Point = [number, number];

export type FieldType = string | number | Date | Point | boolean | ModelCore;

export type ValidFieldNames<T> = { [K in keyof T]: T[K] extends FieldType ? K : never }[keyof T];

export type RetainFields<T> = Pick<T, ValidFieldNames<T>>;
