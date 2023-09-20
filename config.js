export const config = {
  appKey: "",
  accessToken: process.env.FS_ACCESS_TOKEN || "p0-...",
  minDelay: 300,
  maxDelay: 1000,
  timeout: 10000,
  // skip explicit unknown matches, but leave ones that could be intersting
  // e.g. "unknown mistresses of Richard I of Normandy"
  knownUnknowns: [
    " '",
    "_____ _____",
    "-",
    "Unknown",
    "unknown",
    "",
    "?",
    "? ?",
    "??",
    "???",
    ".",
    "`",
    "A",
    "(Mädchen)",
    "(Mother)",
    "N.N.",
    "NN",
    "nn NN",
    "Nn Nn",
    "NN unknown",
    "nn unknown",
    "UNKNOWN",
    "Unknown Alias",
    "Unknown end",
    "Unknown Father",
    "unkown",
    "Unkown",
    "unnamed wife",
    "Unnamed",
    "UNKNOWN FATHER",
    "nn nn",
    "nn.nn",
    "no one",
    "Unk",
    "unk unk",
    "N.",
    "n.n.",
    "(NN) ... (NN) CHINA",
    "(NN) ... (NN) CHINA HAN DYNASTY",
    "Desconhecido",
    "Desconhecida",
    "Not Known",
  ],
};

export default config;
