/**
 * if you have fixed a record in the FamilySearch database
 * (e.g. you have pruned a cyclic relationship that was invalid--probably so unless time travel is real)
 * then you can use this script to remove records pertaining to that id
 * which will then allow you to re-run the index script to generate a new local graph
 *
 * node purge.js L4MM-Z1K
 */

import chalk from "chalk";
import fs from "fs";
const id = process.argv[2];

const purgeFile = (file) => {
  console.log(`purging ${chalk.blue(file)}...`);
  fs.unlinkSync(file);
  console.log(`purged ${chalk.blue(file)}`);
};
fs.readdirSync("./data").forEach((file) => {
  if ([".", ".."].includes(file)) return;
  const filePath = `./data/${file}`;
  //   console.log(filePath);
  if (fs.lstatSync(filePath).isDirectory()) {
    fs.readdirSync(filePath).forEach((file2) => {
      if ([".", ".."].includes(file2)) return;
      //   console.log(`${filePath}/${file2}`);
      if (file2.includes(id)) {
        return purgeFile(`${filePath}/${file2}`);
      }
      if (fs.readFileSync(`${filePath}/${file2}`).toString().includes(id)) {
        return purgeFile(`${filePath}/${file2}`);
      }
    });
    return;
  }
  if (file.includes(id)) {
    return purgeFile(filePath);
  }
  const content = fs.readFileSync(filePath).toString();
  if (content.includes(id)) {
    return purgeFile(filePath);
  }
});
