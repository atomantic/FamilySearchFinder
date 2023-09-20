import fs from "fs";
import fscget from "./lib/fscget.js";
import chalk from "chalk";
import randInt from "./lib/randInt.js";
import config from "./config.js";
import sleep from "./lib/sleep.js";

// FS_ACCESS_TOKEN=YOUR_ACCESS_TOKEN node . 9H8F-V2S

const selfID = process.argv[2];
const maxGenerations = Number(process.argv[3] || Infinity);

const { minDelay, maxDelay } = config;

const db = {};

const getPerson = async (id, generation) => {
  if (generation > maxGenerations) return;
  if (db[id]) return; // already indexed
  const file = `./data/person/${id}.json`;
  if (!fs.existsSync(file)) {
    const data = await fscget(`/platform/tree/persons/${id}`).catch((e) => {
      console.error("error getting person for", id, e);
      process.exit(1);
    });
    if (data) {
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
    }
    const sleepInt = randInt(minDelay, maxDelay);
    await sleep(sleepInt);
  }
  const json = JSON.parse(fs.readFileSync(file));
  const selfRef = json.persons[0];
  const parentData = (selfRef?.display?.familiesAsChild || [{}])[0];
  const parents = [];
  const parent1 = parentData?.parent1?.resourceId;
  const parent2 = parentData?.parent2?.resourceId;
  if (parent1) parents.push(parent1);
  if (parent2) parents.push(parent2);
  const lifespan = selfRef?.display?.lifespan;
  const name = selfRef?.display?.name || "unknown";
  const location = selfRef?.display?.birthPlace || selfRef?.display?.deathPlace;
  const occupation = (
    selfRef?.facts.find((f) => f.type === "http://gedcomx.org/Occupation") || {}
  ).value;
  console.log(
    `${chalk.inverse(selfRef.id)}: ${`(${parent1 || "unknown"}+${
      parent2 || "unknown"
    })`.padEnd(19, " ")} ${`${lifespan || ""}`.padEnd(16, " ")} ${name} (${
      occupation || ""
    }), ${location || ""}`
  );
  // skip saving any entry that is a placeholder/unknown termination point
  if (!parent1 && !parent2 && config.knownUnknowns.includes(name)) return;
  db[id] = {
    name,
    lifespan,
    location,
    parents,
    occupation,
    // will populate later (as we only want children from within this line)
    children: [],
  };
  if (parent1) await getPerson(parent1, generation + 1);
  if (parent2) await getPerson(parent2, generation + 1);
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
