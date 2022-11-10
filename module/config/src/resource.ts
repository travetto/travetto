import { Env, FileResourceProvider } from '@travetto/base';

export class ConfigResource extends FileResourceProvider {
  depth = 1;
  ext = /[.]ya?ml$/;

  constructor(paths: string[] = Env.getList('TRV_RESOURCES')) {
    super(paths);
  }

  async getAvailableProfiles(): Promise<string[]> {
    return (await this.query(x => this.ext.test(x)))
      .map(x => x.replace(this.ext, ''));
  }

  async loadByProfiles(profiles: string[], extFilter: RegExp = this.ext): Promise<{ text: string, profile: string }[]> {
    const profileIndex = Object.fromEntries(Object.entries(profiles).map(([k, v]) => [v, +k] as const));

    const files = (await this.query(f => extFilter.test(f)))
      .map(file => ({ file, profile: file.replace(extFilter, '') }))
      .filter(({ profile }) => profile in profileIndex)
      .sort((a, b) => profileIndex[a.profile] - profileIndex[b.profile]);

    const out: { text: string, profile: string }[] = [];

    for (const { profile, file } of files) {
      out.push({ profile, text: await this.read(file) });
    }

    return out;
  }
}