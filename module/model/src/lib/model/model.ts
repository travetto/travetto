import { Base } from '@encore/mongo';

export interface ModelCore extends Base {
  _type?: string;
  preSave?: () => this;
  postLoad?: () => this;
}