// FS_ACCESS_TOKEN=YOUR_ACCESS_TOKEN node . 9H8F-V2S --max=3 --cache=complete --ignore=M1XP-LRY

import fs from "fs";
import fscget from "./lib/fscget.js";
import randInt from "./lib/randInt.js";
import config from "./config.js";
import sleep from "./lib/sleep.js";
import json2person from "./lib/json2person.js";
import logPerson from "./lib/logPerson.js";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
const argv = yargs(hideBin(process.argv)).argv;
const [selfID] = argv._;
const maxGenerations = Number(argv.max || Infinity);
const ignoreIDs = (argv.ignore || "").split(",");
// cache method can be "all" or "none", or "complete"
const cacheMode = argv.cache || "all";
const oldest = argv.oldest;
const logToTSV = argv.tsv;

if (logToTSV) {
  fs.writeFileSync(
    `./data/${selfID}.tsv`,
    "Generation\tID\tParents\tLifespan\tName\tInstances\tLocation\tOccupation\tBio\n"
  );
}

const { minDelay, maxDelay } = config;

const icons = {
  cached: "💾",
  refreshed: "🔄",
  new: "✅",
};

const activity = {
  new: 0,
  cached: 0,
  refreshed: 0,
  generations: 0,
  deepest: "",
};

const db = {};

// console.log(
//   `finding ${maxGenerations} generations from ${selfID} with cacheMode ${cacheMode}...`
// );
// process.exit();
const getPerson = async (id, generation) => {
  if (generation > maxGenerations) return;
  if (generation > activity.generations) {
    activity.generations = generation;
    activity.deepest = id;
  }
  if (ignoreIDs.includes(id)) return console.log(`skipping ${id}...`);
  if (db[id]) return; // already indexed
  const file = `./data/person/${id}.json`;
  let apidata;
  let contents = "";
  const cached = fs.existsSync(file);
  let icon = cached ? icons.cached : icons.new;
  let getAPIData = !cached;
  if (cacheMode === "all" && !cached) getAPIData = true;
  if (cacheMode === "none") getAPIData = true;
  if (cacheMode === "complete" && cached) {
    // see if this file has known parents (not a node with unkown links)
    contents = fs.readFileSync(file).toString();
    apidata = JSON.parse(contents);
    const person = json2person(apidata);
    // if (!person?.parents) {
    //   console.log(id, person, apidata, file);
    //   process.exit();
    // }
    if (person && person.parents.length !== 2) getAPIData = true;
  }
  if (getAPIData) {
    if (icon === icon.cached) {
      icon = icon.refreshed;
      activity.refreshed++;
    } else {
      activity.new++;
    }
    apidata = await fscget(`/platform/tree/persons/${id}`).catch(
      async (response) => {
        if (
          response?.data?.errors &&
          response.data.errors[0].message.includes(`Unable to read Person`)
        ) {
          // this node was deleted from the API
          // go back up through the current cached db and ensure
          // we purge this person from disk and reload data for children
          console.log(`purging ${id} from cache and reloading children...`);
          if (cached) fs.unlinkSync(file);
          delete db[id];
          const dbIds = Object.keys(db);
          for (let i = 0; i < dbIds.length; i++) {
            const child = dbIds[i];
            if (db[child].parents.includes(id)) {
              // need to refresh this child
              console.log(`refreshing child ${child}...`);
              await getPerson(child, generation - 1);
            }
          }
          return;
        } else {
          console.error(
            "error getting person for",
            id,
            `you may want to run:\nnode purge ${id}`,
            response.data.errors
          );
          process.exit(1);
        }
      }
    );
    if (apidata) {
      const jsondata = JSON.stringify(apidata, null, 2);
      if (contents !== jsondata) {
        // console.log(contents, "!=", jsondata);
        fs.writeFileSync(file, jsondata);
      }
    } else {
      return console.log(`no apidata for ${id}`);
    }
    const sleepInt = randInt(minDelay, maxDelay);
    await sleep(sleepInt);
  } else {
    activity.cached++;
  }
  const json = apidata || JSON.parse(fs.readFileSync(file));
  const person = json2person(json);

  if (!person) return console.log(`no person for ${id} (${json.name})`);

  // check if person is too old
  if (oldest) {
    const oldestYear =
      Number(String(oldest).replace("BC", "")) *
      (String(oldest).includes("BC") ? -1 : 1);
    const [birth, death] = (person.lifespan || "").split("-");
    let birthYear = Number.MAX_SAFE_INTEGER;
    if (birth) {
      birthYear =
        Number(birth.replace("BC", "")) * (birth.includes("BC") ? -1 : 1);
    }
    if (birthYear < oldestYear) {
      console.log(
        `skipping ${id} (${person.lifespan}) because it is older than ${oldest}...`
      );
      return;
    }
  }

  db[id] = person;
  logPerson({ person: { ...db[id], id }, icon, generation, logToTSV, selfID });
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

  const fileName = `./data/db-${selfID}${
    maxGenerations < Infinity ? `-${maxGenerations}` : ""
  }.json`;
  fs.writeFileSync(fileName, JSON.stringify(db, null, 2));

  console.log(
    `finished building ${fileName} with ${
      Object.keys(db).length
    } people, cached: ${activity.cached}, refreshed: ${
      activity.refreshed
    }, new: ${activity.new}, max generation: ${activity.generations} with ${
      activity.deepest
    }`
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
