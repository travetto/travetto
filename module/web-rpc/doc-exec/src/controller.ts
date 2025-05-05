import { Controller, Get } from '@travetto/web';

@Controller('/draft')
export class DraftController {

  @Get('/suggest/tags')
  async getTags(q?: string): Promise<string[]> {
    return [.../* To fill in */[q ?? '']];
  }
}