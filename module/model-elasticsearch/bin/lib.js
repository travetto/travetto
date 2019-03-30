async function getSchemas() {
  await require('@travetto/base/bin/start').run();
  const di = require('@travetto/di').DependencyRegistry;
  const mod = require('@travetto/model').ModelRegistry;
  const srcCls = require('@travetto/model').ModelSource;
  const src = await di.getInstance(srcCls);
  const util = require('../src/util').ElasticsearchUtil;
  const out = {};
  for (const cls of mod.getClasses()) {
    out[src.getCollectionName(cls)] = util.generateSourceSchema(cls);
  }
  return out;
}

module.exports = { getSchemas };