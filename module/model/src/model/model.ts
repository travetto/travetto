export interface ModelCore {
  id?: string;
  type?: string;
  prePersist?(): this;
  postLoad?(): this;
}