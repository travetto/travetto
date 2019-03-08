import * as Generator from 'yeoman-generator';

import { FsUtil } from '@travetto/base';

import { FEATURES, pkg } from './features';
import { verifyDestination, meetsRequirement } from './util';
import { Context, getContext } from './context';

export class TravettoGenerator extends Generator {
  constructor(args: string[], options: any) {
    super(args, options);

    this.option('template', { type: String, default: 'todo' });
    this.argument('name', { type: String, required: false });
  }

  async init() {
    let name: string = (this.options as any).name;

    if (!name) {
      const res = await this.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Enter a name for application: '
        }
      ]);
      name = res.name;
    }

    this.destinationRoot(FsUtil.resolveUnix(process.env.FINAL_CWD!, name));

    try {
      verifyDestination(this.destinationPath('package.json'));
    } catch (err) {
      console.error(err);
      process.exit(1);
    }

    const context = getContext(name);
    context.template = (this.options as any).template;

    this.sourceRoot(FsUtil.resolveUnix(__dirname, `../templates/${(this.options as any).template}`));

    return context;
  }

  async getModules(context: Context) {

    const { modules } = await this.prompt([
      {
        type: 'checkbox',
        choices: Object.keys(FEATURES).sort(),
        name: 'modules',
        message: 'Select high level modules you want to use: '
      }
    ]);

    context.modules.push(...modules);
    context.depList.push(...modules);

  }

  async getModuleImpls(context: Context) {
    const implPrompts = [];

    const modules = Object.keys(FEATURES) as (keyof typeof FEATURES)[];

    for (const mod of modules) {
      if (context.modules.includes(mod) && FEATURES[mod] && FEATURES[mod].sub) {
        implPrompts.push({
          type: 'list',
          choices: FEATURES[mod].sub,
          name: mod,
          default: FEATURES[mod].default,
          message: `Choose the ${mod} implementation: `
        });
      }
    }

    if (implPrompts.length) {
      const impls = await this.prompt(implPrompts);
      for (const mod of modules) {
        context.depList.push(`${mod} -${impls[mod]} `);
        if (FEATURES[mod].addons) {
          context.depList.push(...FEATURES[mod].addons);
        }
        const sub = impls[mod];
        Object.assign(context, (FEATURES[mod].context as any)[sub] || pkg(mod, sub));
      }
    }
  }

  async templateFiles(context: Context) {
    const files = require(FsUtil.resolveUnix(this.sourceRoot(), 'listing.js')) as { [key: string]: { requires?: string[] } };
    for (const key of Object.keys(files)) {
      const conf = files[key];
      if (conf.requires && !meetsRequirement(context.depList, conf.requires)) {
        continue;
      }
      this.fs.copyTpl(this.templatePath(`${key}.ejs`), this.destinationPath(key), context);
    }

    for (const f of ['tsconfig.json', 'tslint.json', '.gitignore']) {
      this.fs.copyTpl(
        FsUtil.resolveUnix(__dirname, `../templates/common/${f}.ejs`),
        this.destinationPath(f.replace(/_/, '/')),
        context
      );
    }
  }

  async start() {
    const context = await this.init();

    await this.getModules(context);
    await this.getModuleImpls(context);
    await this.templateFiles(context);

    await this.npmInstall();
  }
}
