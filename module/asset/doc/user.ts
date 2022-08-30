// @with-module @travetto/model
import { Model } from '@travetto/model';

@Model()
export class User {
  id: string;
  profileImage: string;
}