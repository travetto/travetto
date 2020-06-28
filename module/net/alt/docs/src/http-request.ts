import { HttpRequest } from '../../..';

HttpRequest.exec({
  url: 'https://gooogle.com',
}).then(res => {
  console.log(res);
});