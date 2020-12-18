import * as Generator from 'yeoman-generator';

import { FsUtil, EnvUtil } from '@travetto/boot';

import { FEATURES, Feature } from './features';
import { verifyDestination, meetsRequirement, template } from './util';
import { Context } from './context';

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

    await this._resolveFeatures(context, FEATURES);

    // Finalize
    context.finalize();

    await this._templateFiles(context);

    await this.npmInstall();

    if (context.peerDependencies) {
      await this.npmInstall(context.peerDependencies);
    }
  }

  async _init() {
    let name: string = (this.options as unknown as { name: string }).name;

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

    this.destinationRoot(FsUtil.resolveUnix(EnvUtil.get('TRV_GEN_CWD')!, name));

    try {
      if (!EnvUtil.isTrue('TRV_GEN_NO_VERIFY')) {
        verifyDestination(this.destinationPath('package.json'));
      }
    } catch (err) {
      console.error('Failed to verify destination', { error: err });
      process.exit(1);
    }

    const context = new Context(name);

    context.template = (this.options as unknown as { template: string }).template;

    this.sourceRoot(FsUtil.resolveUnix(__dirname, `../templates/${context.template}`));

    return context;
  }

  async _chooseFeature(feature: Feature): Promise<Feature> {
    const { choice } = await this.prompt({
      type: 'list',
      name: 'choice',
      message: 'Please select one',
      choices: feature.choices!.map(x => x.title!),
      default: feature.default
    });

    return feature.choices!.find(x => x.title === choice)!;
  }

  async _addDependency(context: Context, feat: Feature) {

    if (feat.npm.startsWith('@travetto')) {
      context.frameworkDependencies.push(feat.npm);
    } else {
      context.peerDependencies.push(feat.npm);
    }

    for (const addon of (feat.addons ?? [])) {
      this._addDependency(context, addon);
    }
  }

  async _resolveFeatures(context: Context, features: Feature[], chosen = false) {
    for (const feat of features) {
      if (!chosen) {
        const ans: any = await this.prompt([{
          type: 'confirm',
          name: 'choice',
          message: `Include ${feat.title} support?`
        }]);

        if (ans.choice === 'No' || ans.choice === false) {
          continue;
        }
      }

      if (feat.choices) {
        const choice = await this._chooseFeature(feat);
        await this._resolveFeatures(context, [choice], true);
      }

      await this._addDependency(context, feat);
    }
  }

  async _templateFiles(context: Context) {
    const files = require(FsUtil.resolveUnix(this.sourceRoot(), 'listing.json')) as Record<string, { requires?: string[] }>;
    for (const key of Object.keys(files)) {
      const conf = files[key];
      if (conf.requires && !meetsRequirement(context.frameworkDependencies, conf.requires)) {
        continue;
      }
      this.fs.write(finalize(this.destinationPath(key)), await template(this.templatePath(key), context));
    }
  }
}
