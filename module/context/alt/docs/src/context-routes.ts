// @file-if @travetto/rest
import { Inject } from '@travetto/di';

import { Controller, Post, Body } from '@travett/rest';
import { AsyncContext } from '../../../src/service';
import { Preferences } from './model';


class PreferenceService {
  private context: AsyncContext;

  async update(prefs: Preferences) {
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
  async save(@Body() prefs: Preferences) {
    await this.service.update(prefs);
    return { success: true };
  }
}