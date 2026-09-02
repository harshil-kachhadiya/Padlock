import { readFileSync, writeFileSync } from "fs";

const css = readFileSync("extension/styles.css", "utf8");

const files = ["store-assets/harness/vault.html", "store-assets/harness/add-entry.html", "store-assets/harness/unlock.html"];

for (const f of files) {
  let html = readFileSync(f, "utf8");
  html = html.replace(
    /\s*<style>@import[^<]*<\/style>\s*<link rel="stylesheet" href="\.\.\/\.\.\/extension\/styles\.css" \/>/,
    `\n    <style>\n${css}\n    </style>`
  );
  html = html.replace(
    /\s*<link rel="stylesheet" href="\.\.\/\.\.\/extension\/styles\.css" \/>/,
    `\n    <style>\n${css}\n    </style>`
  );
  writeFileSync(f, html);
}
console.log("done");
