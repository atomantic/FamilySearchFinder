/**
 * move all people in the data/person collection that are not in a given DB file
 * to the data/pruned folder
 */

import fs from "fs";
import json2person from "./lib/json2person.js";
import logPerson from "./lib/logPerson.js";

const id = process.argv[2];

const db = JSON.parse(fs.readFileSync(`data/db-${id}.json`).toString());

const people = Object.keys(db);

console.log(`${id} has ${people.length} records`);
const files = fs.readdirSync("data/person");

files.forEach((f) => {
  if ([".", ".."].includes(f) || !f.includes(".json")) return;
  const id = f.replace(".json", "");
  if (!people.includes(id)) {
    const json = JSON.parse(fs.readFileSync(`data/person/${f}`));
    const person = json2person(json);
    if (person) {
      logPerson({ person });
      fs.renameSync(`data/person/${f}`, `data/pruned/${f}`);
    }
  }
});
