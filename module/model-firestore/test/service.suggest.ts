import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Model } from '@travetto/model';
import { BaseModelSuite } from '@travetto/model/support/test/base.ts';

import { FirestoreModelConfig, FirestoreModelService } from '@travetto/model-firestore';

@Model('firestore_suggest_item')
class SuggestItem {
  id: string;
  name: string;
}

// 60 'ap'-prefixed names, 60 'ba'-prefixed names, 20 'ch'-prefixed names = 140 total
const AP_NAMES = [
  'apple', 'apricot', 'apostle', 'apathy', 'apex', 'apiece', 'aplomb', 'apnea',
  'apollo', 'apparel', 'appeal', 'appear', 'append', 'apple2', 'applet', 'apply',
  'appoint', 'appraise', 'approve', 'aptitude', 'aptly', 'aport', 'apogee', 'apron',
  'apse', 'apt', 'aped', 'aper', 'apes', 'aphis', 'apia', 'apian',
  'apiary', 'apical', 'apices', 'apiece2', 'apish', 'apism', 'aply', 'apneal',
  'apostate', 'apothegm', 'appease', 'appetize', 'applaud', 'applause', 'apple3', 'apple4',
  'apple5', 'apple6', 'apple7', 'apple8', 'apple9', 'apple10', 'apple11', 'apple12',
  'apple13', 'apple14', 'apple15', 'apple16',
];

const BA_NAMES = [
  'banana', 'bamboo', 'banjo', 'bandit', 'banner', 'banyan', 'barley', 'barrel',
  'basil', 'basket', 'bassoon', 'bathe', 'battle', 'bayou', 'bazaar', 'babble',
  'badger', 'baffle', 'ballad', 'ballet', 'ballot', 'balm', 'bamboo2', 'bandage',
  'bangle', 'banter', 'barb', 'bard', 'bargain', 'bark', 'barn', 'barrage',
  'barrier', 'baste', 'batch', 'bathe2', 'baton', 'batter', 'beacon', 'beak',
  'balance', 'bale', 'baleful', 'balk', 'ballast', 'bane', 'banish', 'bank',
  'bankroll', 'bare', 'barely', 'barren', 'barricade', 'bay', 'baying', 'bayonet',
  'bazooka', 'backpack', 'backstop', 'badminton',
];

const CH_NAMES = [
  'cherry', 'citrus', 'charm', 'chair', 'chalk', 'chance', 'change', 'channel',
  'chant', 'chapel', 'chapter', 'charge', 'chart', 'chase', 'chasm', 'cheap',
  'cheer', 'chess', 'chest', 'chime',
];

@Suite()
class FirestoreSuggestSearchSuite extends BaseModelSuite<FirestoreModelService> {
  serviceClass = FirestoreModelService;
  configClass = FirestoreModelConfig;

  async #seed(service: FirestoreModelService, names: string[]): Promise<void> {
    await Promise.all(names.map(name => service.create(SuggestItem, SuggestItem.from({ name }))));
  }

  @Test('suggestSearch returns items matching prefix')
  async testSuggestSearchBasic() {
    const service = await this.service;

    await this.#seed(service, [...AP_NAMES, ...BA_NAMES, ...CH_NAMES]);

    const results = await service.suggestSearch(SuggestItem, 'name', 'ap', { limit: AP_NAMES.length });

    assert(results.length === AP_NAMES.length);
    assert(results.every(r => r.name.startsWith('ap')));
  }

  @Test('suggestSearch returns empty array when no items match prefix')
  async testSuggestSearchNoMatch() {
    const service = await this.service;

    await this.#seed(service, [...AP_NAMES, ...BA_NAMES, ...CH_NAMES]);

    const results = await service.suggestSearch(SuggestItem, 'name', 'zzz');

    assert(results.length === 0);
  }

  @Test('suggestSearch respects limit option')
  async testSuggestSearchLimit() {
    const service = await this.service;

    await this.#seed(service, [...AP_NAMES, ...BA_NAMES, ...CH_NAMES]);

    const results = await service.suggestSearch(SuggestItem, 'name', 'ba', { limit: 5 });

    assert(results.length === 5);
    assert(results.every(r => r.name.startsWith('ba')));
  }
}
