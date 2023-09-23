export const pathShortest = (graph, source, target) => {
  let queue = [source],
    visited = { [source]: true },
    parents = {},
    tail = 0;
  while (tail < queue.length) {
    let id = queue[tail++];
    let children = graph[id].children;
    for (let i = 0, len = children.length; i < len; ++i) {
      let child = children[i];
      if (visited[child]) {
        continue;
      }
      visited[child] = true;
      if (child === target) {
        let path = [child];
        while (id !== source) {
          path.push(id);
          id = parents[id];
        }
        path.push(id);
        path.reverse();
        return path;
      }
      parents[child] = id;
      queue.push(child);
    }
  }
  return [];
};

export default pathShortest;
