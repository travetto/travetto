import { Base } from '@encore/mongo';

export interface ModelCore extends Base {
  preSave?: () => this;
  postLoad?: () => this;
}