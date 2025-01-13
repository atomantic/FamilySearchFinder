export const config = {
  appKey: "",
  accessToken: process.env.FS_ACCESS_TOKEN || "p0-...",
  minDelay: 200,
  maxDelay: 800,
  timeout: 10000,
  // skip explicit unknown matches, but leave ones that could be intersting
  // e.g. "unknown mistresses of Richard I of Normandy"
  knownUnknowns: [
    " '",
    "_____ _____",
    "-",
    "? ?",
    "???",
    "??",
    "?",
    ".",
    "",
    "(mädchen)",
    "(mother)",
    "(nn) ... (nn) china han dynasty",
    "(nn) ... (nn) china",
    "`",
    "a",
    "desconhecida",
    "desconhecido",
    "end of line",
    "n n",
    "n.",
    "n.n.",
    "nn nn",
    "nn unknown",
    "nn.nn",
    "nn",
    "no one",
    "none",
    "not known",
    "unk unk",
    "unk",
    "unknown alias",
    "unknown end",
    "unknown father",
    "unknown",
    "unkown",
    "unnamed wife",
    "unnamed",
  ],
};

export default config;
