"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rootDir = process.cwd();
const targets = process.argv.slice(2);
const defaultTargets = [path.join(rootDir, "src")];
const mojibakePattern = /Ã|Ä|á»|â‚|Æ|Â|áº|»|Äƒ|Ä‘|Ä/;

function listFiles(inputPath) {
  const stat = fs.statSync(inputPath);
  if (stat.isFile()) {
    return [inputPath];
  }

  return fs.readdirSync(inputPath, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(inputPath, entry.name);
    if (entry.isDirectory()) {
      return listFiles(fullPath);
    }
    if (!/\.(js|ts|ejs|md|css)$/i.test(entry.name)) {
      return [];
    }
    return [fullPath];
  });
}

function mojibakeScore(value) {
  const matches = String(value).match(/Ã|Ä|á»|â‚|Æ|Â|áº|»|Äƒ|Ä‘|Ä/g);
  return matches ? matches.length : 0;
}

function repairLine(line) {
  if (!mojibakePattern.test(line)) {
    return line;
  }

  const repaired = Buffer.from(line, "latin1").toString("utf8");
  return mojibakeScore(repaired) < mojibakeScore(line) ? repaired : line;
}

function main() {
  const files = (targets.length > 0 ? targets : defaultTargets).flatMap((target) => listFiles(path.resolve(target)));
  let changedFiles = 0;
  let changedLines = 0;

  for (const filePath of files) {
    const original = fs.readFileSync(filePath, "utf8");
    const normalized = original.replace(/\r\n/g, "\n");
    const repairedLines = normalized.split("\n").map((line) => {
      const nextLine = repairLine(line);
      if (nextLine !== line) {
        changedLines += 1;
      }
      return nextLine;
    });
    const repaired = repairedLines.join("\n");
    if (repaired !== normalized) {
      fs.writeFileSync(filePath, repaired.replace(/\n/g, "\r\n"), "utf8");
      changedFiles += 1;
    }
  }

  console.log(JSON.stringify({ changedFiles, changedLines }, null, 2));
}

main();
