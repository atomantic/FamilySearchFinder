/**
 * print out the graph in a flat list, but ordered by birth/death dates
 */

import fs from "fs";
import logPerson from "./lib/logPerson.js";
import config from "./config.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
const argv = yargs(hideBin(process.argv)).argv;

const [id] = argv._;
const bio = !!argv.bio;

const db = JSON.parse(fs.readFileSync(`data/db-${id}.json`).toString());

const sortedPeople = [];
// lifespan can be
// Living, Deceased, BIRTH-DEATH or BIRTH- or -DEATH, BIRTH-Deceased
// it can also contain a BC notation
const fixYear = (year) => {
  if (year.includes("BC")) return Number(year.replace("BC", "")) * -1;
  const n = Number(year);
  return isNaN(n) ? 0 : n;
};

Object.keys(db).forEach((id) => {
  const dates = db[id].lifespan.split("-");
  let birth = fixYear(dates[0] || "");
  let death = fixYear(dates[1] || "");
  let year = birth || death;
  sortedPeople.push({ ...db[id], id, birth, death, year });
});

sortedPeople.sort((a, b) => (a.year < b.year ? -1 : 1));

sortedPeople.forEach((person, generation) =>
  !config.knownUnknowns.includes(person.name.toLowerCase())
    ? logPerson({ person, bio })
    : false
);
