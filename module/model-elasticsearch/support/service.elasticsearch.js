const { version } = require('@elastic/elasticsearch/package.json');

module.exports = {
  name: 'elasticsearch',
  version,
  port: 9200,
  env: {
    'discovery.type': 'single-node'
  },
  image: `docker.elastic.co/elasticsearch/elasticsearch:${version}`
};