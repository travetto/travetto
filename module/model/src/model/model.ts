export interface ModelCore<T> {
  preSave?(): T;
  postLoad?(): T;
}