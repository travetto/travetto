import { Inject } from '@travetto/di';
import { Body, Controller, Post } from '@travetto/web';

import { EmailProvider } from '../email/provider.ts';
import { renderTransactionalEmail } from '../email/render.ts';

@Controller('/{{routePath}}')
export class EmailController {
  @Inject()
  provider: EmailProvider;

  @Post('/')
  async send(@Body() body: { to: string; subject: string; title: string; message: string }): Promise<{ sent: true }> {
    const html = await renderTransactionalEmail({ title: body.title, message: body.message });
    await this.provider.send(body.to, body.subject, html);
    return { sent: true };
  }
}
