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
    methods: Record<string, number>,
    stack: RouteStack[]
  };
}