import * as Generator from 'yeoman-generator';

import { FsUtil } from '@travetto/boot';

import { FEATURES, pkg } from './features';
import { verifyDestination, meetsRequirement, template } from './util';
import { Context, getContext } from './context';

function finalize(path: string) {
  return path.replace('gitignore.txt', '.gitignore');
}


export class TravettoGenerator extends Generator {
  constructor(args: string[], options: any) {
    super(args, options);

    this.option('template', { type: String, default: 'todo' });
    this.argument('name', { type: String, required: false });
  }

  async start() {
    const context = await this._init();

    await this._getModules(context);
    await this._getModuleImpls(context);
    await this._templateFiles(context);

    await this.npmInstall();
  }

  async _init() {
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
      if (!process.env.NO_VERIFY) {
        verifyDestination(this.destinationPath('package.json'));
      }
    } catch (err) {
      console.error(err);
      process.exit(1);
    }

    const context = getContext(name);

    context.template = (this.options as any).template;

    this.sourceRoot(FsUtil.resolveUnix(__dirname, `../templates/${context.template}`));

    return context;
  }

  async _getModules(context: Context) {

    const { modules } = await this.prompt([
      {
        type: 'checkbox',
        choices: Object.keys(FEATURES).sort(),
        name: 'modules',
        message: 'Select high level modules you want to use: '
      }
    ]);

    for (const mod of modules) {
      context.modules.list.push(mod);
      context.modules.map[mod.split('/').pop()] = 1;
    }

    context.dependencies.list.push(...modules);
  }

  async _getModuleImpls(context: Context) {
    const implPrompts = [];

    const modules = Object.keys(FEATURES) as string[];

    for (const mod of modules) {
      const feat = FEATURES[mod];
      if (feat && context.modules.list.includes(mod) && 'sub' in feat) {
        implPrompts.push({
          type: 'list',
          choices: feat.sub,
          name: mod,
          default: feat.default,
          message: `Choose the ${mod} implementation: `
        });
      }
    }

    if (implPrompts.length) {
      const impls = await this.prompt(implPrompts as any);
      for (const mod of modules) {
        const feat = FEATURES[mod];
        const sub = impls[mod];
        if (sub) {
          if (!('sub' in feat) || !feat.external) {
            const full = `${mod}-${sub}`;
            context.dependencies.list.push(full);
            context.modules.map[full] = '1';
            context.modules.list.push(`@travetto/${full}`);
            if ('context' in feat) {
              Object.assign(context, (feat.context as any)[sub] || pkg(mod, sub));
            }
          } else if (feat.external) {
            context.dependencies.list.push(sub);
          }
        }
        if ('addons' in feat) {
          context.dependencies.list.push(...(feat.addons!));
        }
      }
    }
  }


  async _templateFiles(context: Context) {
    const files = require(FsUtil.resolveUnix(this.sourceRoot(), 'listing.json')) as Record<string, { requires?: string[] }>;
    for (const key of Object.keys(files)) {
      const conf = files[key];
      if (conf.requires && !meetsRequirement(context.dependencies.list, conf.requires)) {
        continue;
      }
      this.fs.write(finalize(this.destinationPath(key)), await template(this.templatePath(key), context));
    }
  }
}
