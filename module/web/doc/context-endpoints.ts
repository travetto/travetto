import { Inject } from '@travetto/di';

import { Controller, Post, Body } from '@travetto/web';
import { AsyncContext } from '@travetto/context';

type Preferences = {
  language: string;
};

class PreferenceService {
  private context: AsyncContext;

  async update(preferences: Preferences) {
    // Get user id from an authenticated request
    const userId = this.context.get<string>('userId');
    // Update user
    return userId;
  }
}

@Controller('/user')
class PrefEndpoints {
  @Inject()
  service: PreferenceService;

  @Post('/preferences')
  async save(@Body() preferences: Preferences) {
    await this.service.update(preferences);
    return { success: true };
  }
}