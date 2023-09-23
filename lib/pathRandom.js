import sample from "lodash.sample";
export const pathRandom = async (graph, source, target) => {
  let testID = source;
  const path = [];
  while (testID !== target) {
    let person = graph[testID];
    if (!person) return console.error(testID, `no person found`);
    path.push(testID);
    if (!person.children || !person.children.length)
      return console.error("no children", testID);
    testID = sample(person.children);
  }
  path.push(testID);

  return path;
};
