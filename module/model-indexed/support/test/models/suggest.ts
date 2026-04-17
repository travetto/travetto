import { Model } from '@travetto/model';
import { sortedIndex } from '../../../src/indexes.ts';

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

export const SUGGEST_DATA = [
  ...AP_NAMES,
  ...BA_NAMES,
  ...CH_NAMES,
];

@Model('suggestItem')
export class SuggestItem {
  id: string;
  name: string;
}

export const suggestSort = sortedIndex(SuggestItem, {
  name: 'sortByName',
  key: {},
  sort: {
    name: 1
  }
});