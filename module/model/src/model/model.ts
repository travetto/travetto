export interface ModelCore {
  id?: string;
  type?: string;
  prePersist?(): void;
  postLoad?(): void;
}