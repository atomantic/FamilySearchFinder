import { fsc } from "./fs.client.js";

export const fscget = async (url) =>
  new Promise((resolve, reject) => {
    fsc.get(url, (error, response) => {
      if (error || response.statusCode >= 400) {
        const errors = response?.data?.errors;
        console.error(errors || error || response);
        if (errors && errors[0].label === "Unauthorized") {
          console.error(
            `your FS_ACCESS_TOKEN is invalid, please use a new one.`
          );
          process.exit(1);
        }
        return reject(response);
      }
      // if (!response.data) console.log(response);
      resolve(response.data);
    });
  });

export default fscget;
