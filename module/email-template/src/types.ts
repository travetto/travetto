import { DefaultTreeAdapterMap } from 'parse5';

export type Node = DefaultTreeAdapterMap['parentNode'];
export type Element = DefaultTreeAdapterMap['element'];
export type Document = DefaultTreeAdapterMap['document'];