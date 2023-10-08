/**
 * convert a database file to a tsv file so it can be dropped into a spreadsheet
 *
 * node tsv 9H8F-V2S
 * or limit number of generations using a limited database file
 * node tsv 9H8F-V2S-2
 */
import fs from "fs";
import config from "./config.js";
const idgen = process.argv[2];
const db = JSON.parse(fs.readFileSync(`./data/db-${idgen}.json`));

let tsv = "ID\tName\tBirth\tDeath\tLocation\tOccupation\n";

Object.keys(db).forEach((id) => {
  const person = db[id];
  const name = person.name || "";
  const location = (person.location || "").replace(/\t\n/g, "");
  const occupation = (person.occupation || "").replace(/\t\n/g, "");
  const dates = `${person.lifespan}`.split("-");
  const birth = dates[0] || "";
  const death = dates[1] || "";
  if (config.knownUnknowns.includes(name.toLowerCase())) return;
  tsv += `${id}\t${name}\t${birth}\t${death}\t${location}\t${occupation}\n`;
});

// save the tsv file to data/db-<id>.tsv
fs.writeFileSync(`./data/db-${idgen}.tsv`, tsv);
