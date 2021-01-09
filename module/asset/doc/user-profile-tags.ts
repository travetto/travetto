// @file-if @travetto/model
import { UserProfileService } from './user-profile';
import { User } from './user';

export class UserProfileTagService extends UserProfileService {
  async checkImageGroup(userId: string) {
    const user = await this.model.get(User, userId);
    const info = await this.asset.getMetadata(user.profileImage);

    // Check asset's tags for a specific group
    return info; // TODO: Change
  }
}