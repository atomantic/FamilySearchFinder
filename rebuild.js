/**
 * Rebuild database files from existing person JSON files
 * Uses the updated json2person extraction logic
 *
 * Usage:
 *   node rebuild DB_ID           # Rebuild specific database
 *   node rebuild --all           # Rebuild all databases
 */

import fs from "fs";
import path from "path";
import json2person from "./lib/json2person.js";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
const argv = yargs(hideBin(process.argv)).argv;
const [dbId] = argv._;
const rebuildAll = argv.all;

const DATA_DIR = "./data";
const PERSON_DIR = `${DATA_DIR}/person`;

/**
 * Get list of all database files
 */
const getDatabaseFiles = () => {
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.startsWith("db-") && f.endsWith(".json"))
    .map((f) => ({
      filename: f,
      rootId: f.replace(/^db-/, "").replace(/-\d+\.json$/, "").replace(/\.json$/, ""),
    }));
};

/**
 * Read existing database to get list of person IDs
 */
const getPersonIdsFromDb = (dbPath) => {
  const db = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  return Object.keys(db);
};

/**
 * Read and process a person JSON file
 */
const processPerson = (personId) => {
  const file = path.join(PERSON_DIR, `${personId}.json`);
  if (!fs.existsSync(file)) {
    console.log(`  Warning: Missing person file for ${personId}`);
    return null;
  }

  const json = JSON.parse(fs.readFileSync(file, "utf-8"));
  return json2person(json);
};

/**
 * Rebuild a single database
 */
const rebuildDatabase = (dbPath, rootId) => {
  console.log(`\nRebuilding ${dbPath}...`);

  // Get person IDs from existing database
  const personIds = getPersonIdsFromDb(dbPath);
  console.log(`  Found ${personIds.length} persons in database`);

  // Re-process each person
  const db = {};
  let processed = 0;
  let skipped = 0;

  for (const id of personIds) {
    const person = processPerson(id);
    if (person) {
      db[id] = person;
      processed++;
    } else {
      skipped++;
    }
  }

  // Add children relationships
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

  // Write updated database
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

  console.log(`  Processed: ${processed}, Skipped: ${skipped}`);
  console.log(`  Database saved to ${dbPath}`);

  // Show sample of new fields
  const sampleId = personIds[0];
  const sample = db[sampleId];
  if (sample) {
    console.log(`\n  Sample person (${sampleId}):`);
    console.log(`    Name: ${sample.name}`);
    console.log(`    Gender: ${sample.gender}`);
    console.log(`    Living: ${sample.living}`);
    if (sample.alternateNames?.length) {
      console.log(`    Alternate names: ${sample.alternateNames.join(", ")}`);
    }
    if (sample.birth) {
      console.log(`    Birth: ${sample.birth.date} at ${sample.birth.place}`);
    }
    if (sample.death) {
      console.log(`    Death: ${sample.death.date} at ${sample.death.place}`);
    }
    if (sample.occupations?.length) {
      console.log(`    Occupations: ${sample.occupations.join(", ")}`);
    }
    if (sample.spouses?.length) {
      console.log(`    Spouses: ${sample.spouses.join(", ")}`);
    }
    console.log(`    Lifespan: ${sample.lifespan}`);
    console.log(`    Location: ${sample.location}`);
  }

  return db;
};

/**
 * Main entry point
 */
const main = () => {
  if (!rebuildAll && !dbId) {
    console.error("Usage: node rebuild DB_ID  or  node rebuild --all");
    process.exit(1);
  }

  const databases = getDatabaseFiles();

  if (rebuildAll) {
    console.log(`Found ${databases.length} databases to rebuild`);
    for (const { filename, rootId } of databases) {
      rebuildDatabase(path.join(DATA_DIR, filename), rootId);
    }
  } else {
    // Find matching database
    const match = databases.find(
      (d) => d.rootId === dbId || d.filename === `db-${dbId}.json`
    );

    if (!match) {
      console.error(`Database not found for ID: ${dbId}`);
      console.log("Available databases:");
      databases.forEach((d) => console.log(`  - ${d.rootId} (${d.filename})`));
      process.exit(1);
    }

    rebuildDatabase(path.join(DATA_DIR, match.filename), match.rootId);
  }

  console.log("\nRebuild complete!");
};

main();
