/**
 * find a path back to me from a particular person id
 * node find 9H8F-V2S L163-DR5
 * will find a path from L163-DR5 to 9H8F-V2S by reverse searching the children under 9H8F-V2S
 */

import chalk from "chalk";
import fs from "fs";
import sample from "lodash.sample";

const selfID = process.argv[2];
const searchID = process.argv[3];
const maxGenerations = process.argv[4] || "";

const db = JSON.parse(
  fs.readFileSync(
    `./data/db-${selfID}${maxGenerations ? `-${maxGenerations}` : ""}.json`
  )
);
const fullPath = [];

/*
db is an object that has the id keys for every parent entry
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

const logItem = (id, children) => {
  console.log(
    chalk.blue(id),
    chalk
      .hex("#EEEEEE")
      .inverse(db[id]?.lifespan.padStart(18, " ").padEnd(20, " ")),
    chalk.hex("#DEADED").bold(db[id]?.name),
    children.length > 1 ? `(x${children.length})` : ``
  );
};

const findPath = async (id) => {
  let testID = id;

  while (testID !== selfID) {
    const person = db[testID];
    if (!person) return console.error(testID, `no person found`);
    fullPath.push(testID);
    logItem(testID, person.children);
    if (!person.children || !person.children.length)
      return console.error("no children", testID);
    // there might be a shorter path on other children:
    testID = sample(person.children);
  }

  const person = db[testID];
  fullPath.push(testID);
  logItem(testID, person.children);

  // const person = db[id];
  // if (!person) return console.error(id, `no person found`);
  // if (!person.children || !person.children.length)
  //   return log.error("no children", id);

  // return findPath(person.children[0]);
};

(async () => {
  console.log(
    `finding path to ${chalk.blue(searchID)} in ${chalk.blue(selfID)}...`
  );
  await findPath(searchID);

  // fullPath.forEach(logItem);
  console.log(
    `found path from ${searchID} (${db[searchID]?.name}) to ${selfID} (${
      db[selfID]?.name
    }) in ${chalk.inverse(fullPath.length - 1)} direct generations`
  );
})();
