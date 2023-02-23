import { EmailTemplateCompiler, EmailTemplateResource } from '@travetto/email-template';
import { RootRegistry } from '@travetto/registry';

export async function main(): Promise<void> {

  await RootRegistry.init();

  const compiler = new EmailTemplateCompiler(
    new EmailTemplateResource()
  );

  const res = await compiler.compile('/email/welcome.email.html', true);

  console.log(
    res.html
      .replace(/<head.*?<\/head>/msg, '')
      .replace(/\s+style="[^"]+"/g, '')
  );
}