// Decodes an html2canvas dataURL captured via the browser tool into a PNG.
import { readFileSync, writeFileSync } from "fs";
const [, , src, dest] = process.argv;
const data = JSON.parse(readFileSync(src, "utf8"));
const text = data[0].text.trim().replace(/^"|"$/g, "");
writeFileSync(dest, Buffer.from(text.split(",")[1], "base64"));
console.log("wrote", dest);
