/**
 * find a path back to me from a particular person id
 * node find 9H8F-V2S L163-DR5
 * will find a path from L163-DR5 to 9H8F-V2S by reverse searching the children under 9H8F-V2S
 */

import chalk from "chalk";
import fs from "fs";
import { pathShortest } from "./lib/pathShortest.js";
import { pathLongest } from "./lib/pathLongest.js";
import { pathRandom } from "./lib/pathRandom.js";
import { logPerson } from "./lib/logPerson.js";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
const argv = yargs(hideBin(process.argv)).argv;

const methods = {
  l: pathLongest,
  s: pathShortest,
  r: pathRandom,
};
const methodName = {
  l: "longest",
  s: "shortest",
  r: "random",
};
const [selfID, searchID] = argv._;
const maxGenerations = argv.max || "";
const methodKey = (argv.method || [])[0] || "s";
const method = methods[methodKey];

const graph = JSON.parse(
  fs.readFileSync(
    `./data/db-${selfID}${maxGenerations ? `-${maxGenerations}` : ""}.json`
  )
);

(async () => {
  console.log(
    `finding ${methodName[methodKey]} path to ${chalk.blue(
      searchID
    )} in ${chalk.blue(selfID)}...`
  );
  if (!graph[searchID]) {
    console.log(`could not find ${searchID} in graph`);
    process.exit();
  }
  const path = await method(graph, searchID, selfID);

  path.forEach((id, i) =>
    logPerson({ person: { ...graph[id], id }, icon: "", generation: i })
  );

  console.log(
    `found path from ${searchID} (${graph[searchID]?.name}) to ${selfID} (${
      graph[selfID]?.name
    }) in ${chalk.inverse(` ${path.length - 1} `)} direct generations`
  );
})();
