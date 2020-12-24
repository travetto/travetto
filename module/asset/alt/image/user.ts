// @file-if @travetto/model-core
import { Model } from '@travetto/model-core';

@Model()
export class User {
  id: string;
  profileImage: string;
}