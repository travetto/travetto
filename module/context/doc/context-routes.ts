// @with-module @travetto/rest
import { Inject } from '@travetto/di';

import { Controller, Post, Body } from '@travetto/rest';
import { AsyncContext } from '@travetto/context';

import { Preferences } from './model';

class PreferenceService {
  private context: AsyncContext;

  async update(preferences: Preferences) {
    // Get user id from an authenticated request
    const userId = this.context.get().userId;
    // Update user
    return userId;
  }
}

@Controller('/user')
class PrefRoutes {
  @Inject()
  service: PreferenceService;

  @Post('/preferences')
  async save(@Body() preferences: Preferences) {
    await this.service.update(preferences);
    return { success: true };
  }
}