import { ResourceManager } from '@travetto/base';
import { TemplateUtil } from '@travetto/email-template/bin/lib/util';

export async function main() {

  const res = await TemplateUtil.compileToDisk(
    await ResourceManager.findAbsolute('/email/welcome.email.html')
  );

  console.log(
    res.html
      .replace(/<head.*?<\/head>/msg, '')
      .replace(/\s+style="[^"]+"/g, '')
  );
}