/**
 * convert FamilySearch person json payload to smaller db/graph person format
 */

import config from "../config.js";
export const json2person = (json) => {
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

  // skip saving any entry that is a placeholder/unknown termination point
  if (!parent1 && !parent2 && config.knownUnknowns.includes(name)) return;
  return {
    name,
    lifespan,
    location,
    parents,
    occupation,
    // will populate later (as we only want children from within this line)
    children: [],
  };
};

export default json2person;
