import { fsc } from "./fs.client.js";

export const fscget = async (url) =>
  new Promise((resolve, reject) => {
    fsc.get(url, (error, response) => {
      if (error || response.statusCode >= 400) {
        console.error(response.statusCode, error || response);
        return reject(response.statusCode);
      }
      // if (!response.data) console.log(response);
      resolve(response.data);
    });
  });

export default fscget;
