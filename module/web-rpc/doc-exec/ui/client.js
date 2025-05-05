import { factory } from '../api-client/factory';

const client = factory({ url: 'http://localhost:3000' });

client.DraftController.getTags('prefix').then(result => {
  console.log('Found', result);
});