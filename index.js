import fs from "fs";
import fscget from "./lib/fscget.js";
import randInt from "./lib/randInt.js";
import config from "./config.js";
import sleep from "./lib/sleep.js";
import json2person from "./lib/json2person.js";
import logPerson from "./lib/logPerson.js";
// FS_ACCESS_TOKEN=YOUR_ACCESS_TOKEN node . 9H8F-V2S

const selfID = process.argv[2];
const maxGenerations = Number(process.argv[3] || Infinity);

const { minDelay, maxDelay } = config;

const db = {};

const getPerson = async (id, generation) => {
  if (generation > maxGenerations) return;
  if (db[id]) return; // already indexed
  const file = `./data/person/${id}.json`;
  let apidata;
  if (!fs.existsSync(file)) {
    apidata = await fscget(`/platform/tree/persons/${id}`).catch((e) => {
      console.error("error getting person for", id, e);
      process.exit(1);
    });
    if (apidata) {
      fs.writeFileSync(file, JSON.stringify(apidata, null, 2));
    }
    const sleepInt = randInt(minDelay, maxDelay);
    await sleep(sleepInt);
  }
  const json = apidata || JSON.parse(fs.readFileSync(file));
  const person = json2person(json);

  if (!person) return;
  db[id] = person;
  logPerson(db, id);
  if (person.parents[0]) await getPerson(person.parents[0], generation + 1);
  if (person.parents[1]) await getPerson(person.parents[1], generation + 1);
};

const saveDB = async () => {
  // add children to db for each member
  Object.keys(db).forEach((id) => {
    const person = db[id];
    if (!person.parents || !person.parents.length) return;
    person.parents.forEach((parentId) => {
      if (!db[parentId]) return;
      if (!db[parentId].children) db[parentId].children = [];
      if (db[parentId].children.includes(id)) return;
      db[parentId].children.push(id);
    });
  });

  fs.writeFileSync(
    `./data/db-${selfID}${
      maxGenerations < Infinity ? `-${maxGenerations}` : ""
    }.json`,
    JSON.stringify(db, null, 2)
  );
};

process.on("SIGINT", async (err) => {
  await saveDB();
  process.exit();
});

(async () => {
  await getPerson(selfID, 0);
  await saveDB();
})();
