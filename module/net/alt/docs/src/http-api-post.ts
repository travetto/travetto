import { HttpRequest } from '../../../src/request';

interface User {
  id: number;
  name: string;
}

HttpRequest.execJSON<User>({
  url: 'https://localhost:3000/api',
  method: 'post',
}, { id: 5, name: 'Test' }).then(res => {
  console.log(res.name);
});