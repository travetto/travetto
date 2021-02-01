process.env.TRV_ENV = 'prod';

(async function () {
  const { ResourceManager, PhaseManager } = await import('@travetto/base');
  await PhaseManager.run('init');

  const { TemplateUtil } = await import('@travetto/email-template/bin/lib/util');
  const res = await TemplateUtil.compileToDisk(
    await ResourceManager.findAbsolute('/email/welcome.email.html')
  );
  console.log(res.html.replace(/<head.*?<\/head>/msg, '').replace(/\s+style="[^"]+"/g, ''));
})();