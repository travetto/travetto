// @file-if @travetto/model
import { UserProfileService } from './user-profile';
import { User } from './user';

export class UserProfileTagService extends UserProfileService {
  async getImageContentType(userId: string) {
    const user = await this.model.get(User, userId);
    const info = await this.asset.describeStream(user.profileImage);

    return info.contentType;  // Return image content type
  }
}