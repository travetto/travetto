// @file-if @travetto/model
import { UserProfileService } from './user-profile';

export class UserProfileTagService extends UserProfileService {
  async checkImageGroup(userId: string) {
    const user = await this.model.getById(userId);
    const info = await this.asset.info(user.profileImage);

    // Check asset's tags for a specific group
    return info.metadata?.tags?.includes(user.group);
  }
}