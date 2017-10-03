export interface ModelCore {
  id?: string;
  type?: string;
  prePersist?(): any;
  postLoad?(): any;
}