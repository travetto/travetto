export type SimpleType = { [key: string]: SimpleType } | SimpleType[] | undefined | null | string | boolean | RegExp | Date | number;
export type SimpleObject = Record<string, SimpleType>;