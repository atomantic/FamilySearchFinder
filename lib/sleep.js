export const sleep = async (delay) =>
  new Promise((resolve) => setTimeout(resolve, delay));

export default sleep;
