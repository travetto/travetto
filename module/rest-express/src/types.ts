export class RouteStack {
  name: string;
  keys: string[];
  regexp: {
    source: string,
    fast_star: boolean,
    fast_slash: boolean
  };
  handle: {
    key: string;
  };
  route: {
    path: string,
    methods: { [key: string]: number },
    stack: RouteStack[]
  };
}