import { ResourceManager } from '@travetto/base';
import { CompileUtil } from '@travetto/email-template';

export async function main() {

  const res = await CompileUtil.compileToDisk(
    await ResourceManager.findAbsolute('/email/welcome.email.html')
  );

  console.log(
    res.html
      .replace(/<head.*?<\/head>/msg, '')
      .replace(/\s+style="[^"]+"/g, '')
  );
}