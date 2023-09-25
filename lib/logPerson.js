/*
graph is an object that has the id keys for every parent entry
{
  "9H8F-V2S": {
    "name": "Guy le Strange",
    "lifespan": "1048–1105",
    "parents": [
      "L163-ZKX"
    ],
    "children": [
      "G966-3FB"
    ]
  },...
}
*/

import chalk from "chalk";
export const logPerson = (graph, id) => {
  const person = graph[id];
  console.log(
    chalk.blue(id),
    `${`(${person.parents[0] || "unknown"}+${
      person.parents[1] || "unknown"
    })`.padEnd(19, " ")}`,
    chalk
      .hex("#EEEEEE")
      .inverse(person?.lifespan.padStart(18, " ").padEnd(20, " ")),
    chalk.hex("#DEADED").bold(person?.name),
    person.children.length > 1 ? `(x${person.children.length})` : ``
  );
};

export default logPerson;
