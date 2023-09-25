export const pathLongest = (graph, source, target) => {
  let longest = [];
  const queue = [[source]];
  const depthMap = {
    [source]: 0,
  };
  while (queue.length) {
    const path = queue.shift();
    const node = path[path.length - 1];
    if (node === target) {
      //   console.log(
      //     `found path of length ${path.length} from ${source} to ${target}`
      //   );

      if (path.length > longest.length) {
        longest = path;
        //   } else {
      }
    } else {
      const children = graph[node].children;
      children.forEach((child) => {
        if (!depthMap[child]) depthMap[child] = 0;
        if (path.includes(child)) {
          console.error(
            `TIME TRAVELER! Cyclic relationship detected between ${child} and ${node}. Please fix this in the source database.`,
            path.slice(path.indexOf(child)).join(" -> ")
          );
          return;
        }
        // console.log(child, path, depthMap[child], path.length);
        // only queue this child if it is a further distance than we have seen already
        // for this child relationship to the source
        if (depthMap[child] < path.length) {
          queue.push([...path, child]);
          depthMap[child] = path.length;
          // } else {
          //   console.log(
          //     `skipping re-traversing ${child} because we have already seen a path of length ${depthMap[child]} to it`
          //   );
        }
      });
    }
  }

  return longest;
};

export default pathLongest;
