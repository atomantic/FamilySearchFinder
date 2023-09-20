import FamilySearch from "fs-js-lite";

import config from "../config.js";

export const fsc = new FamilySearch({
  environment: "production",
  appKey: config.appKey,
  accessToken: config.accessToken,
  saveAccessToken: true,
  tokenCookie: "FS_AUTH_TOKEN",
  tokenCookiePath: "/",
  maxThrottledRetries: 10,
});

export default fsc;
