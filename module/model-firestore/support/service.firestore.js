const version = 'latest';

module.exports = {
  name: 'firestore',
  version,
  ports: { 7000: 8080 },
  env: {
    FIRESTORE_PROJECT_ID: 'trv-local-dev'
  },
  image: `mtlynch/firestore-emulator-docker:${version}`
};