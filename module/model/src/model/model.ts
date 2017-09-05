export interface ModelCore {
  preSave?: () => this;
  postLoad?: () => this;
}