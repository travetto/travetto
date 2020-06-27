// @file-if @travetto/model
import { ModelService } from '@travetto/model';
import { AssetService } from '../../../src/service';
import { Asset } from '../../../src/types';
import { User } from '../user';

export class UserProfileService {

  constructor(
    public asset: AssetService,
    public model: ModelService
  ) { }

  async saveProfileImage(userId: string, image: Asset) {
    const path = await this.asset.write(image);
    const user = await this.model.getById(User, userId);
    user.profileImage = path;
    await this.model.update(User, user);
  }

  async getProfileImage(userId: string) {
    const user = await this.model.getById(userId);
    return await this.asset.read(user.profileImage);
  }
}