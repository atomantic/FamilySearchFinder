/*
graph is an object that has the id keys for every parent entry
{
  "9H8F-V2S": {
    "name": "Guy le Strange",
    "lifespan": "1048–1105",
    "occupation": "Sheriff of Metz",
    "location": "Metz, Moselle, Lorraine, France",
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
import fs from "fs";
export const logPerson = ({
  person,
  icon,
  generation,
  bio,
  logToTSV,
  selfID,
}) => {
  const gen = generation;
  const cGen =
    typeof gen !== "?"
      ? `${chalk.hex("#EEEEEE").inverse(`${gen}`.padStart(3, "0"))} `
      : "";
  const id = person.id;
  const cID = chalk.blue(person.id);
  const parents = `${person.parents[0] || "?"}+${person.parents[1] || "?"}`;
  const cParents = `(${parents})`.padEnd(19, " ");
  const lifespan = person.lifespan;
  const cLifespan = chalk
    .hex("#EEEEEE")
    .inverse(lifespan.padStart(18, " ").padEnd(20, " "));
  const name = person.name;
  const cName = chalk.hex("#DEADED").bold(person.name);
  const instances = person.children.length;
  const cInstances =
    person.children.length > 1
      ? ` ${chalk.hex("#d6406e").bold(`(x${person.children.length})`)}`
      : ``;
  const location = person.location || "";
  const cLocation = person.location ? `, ${person.location}` : "";
  const occupation = person.occupation || "";
  const cOccupation = person.occupation
    ? chalk.blue(`, ${person.occupation}`)
    : "";

  const logString = `${
    icon ? `${icon} ` : ``
  }${cGen}${cID} ${cParents} ${cLifespan} ${cName}${cInstances}${cLocation}${cOccupation}${
    bio ? ` - ${person.bio}` : ""
  }`;
  console.log(logString);
  if (logToTSV) {
    fs.appendFileSync(
      `./data/${selfID}.tsv`,
      `${gen}\t${id}\t${parents}\t${lifespan}\t${name}\t${instances}\t${location}\t${occupation}\t${
        person.bio || ""
      }\n`
    );
  }
};

export default logPerson;
