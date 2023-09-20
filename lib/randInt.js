// min and max inclusive
export default function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
