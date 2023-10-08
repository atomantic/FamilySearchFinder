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
export const logPerson = ({ person, icon, generation, bio }) => {
  const id = chalk.blue(person.id);
  const parents = `${`(${person.parents[0] || "unknown"}+${
    person.parents[1] || "unknown"
  })`.padEnd(19, " ")}`;
  const lifespan = chalk
    .hex("#EEEEEE")
    .inverse(person?.lifespan.padStart(18, " ").padEnd(20, " "));
  const name = chalk.hex("#DEADED").bold(person.name);
  const multiplier =
    person.children.length > 1
      ? ` ${chalk.hex("#d6406e").bold(`(x${person.children.length})`)}`
      : ``;
  const location = person.location ? `, ${person.location}` : "";
  const occupation = person.occupation
    ? chalk.blue(`, ${person.occupation}`)
    : "";

  const gen =
    typeof generation !== "undefined"
      ? `${chalk.hex("#EEEEEE").inverse(`${generation}`.padStart(3, "0"))} `
      : "";
  console.log(
    `${
      icon ? `${icon} ` : ``
    }${gen}${id} ${parents} ${lifespan} ${name}${multiplier}${location}${occupation}${
      bio ? ` - ${person.bio}` : ""
    }`
  );
};

export default logPerson;
