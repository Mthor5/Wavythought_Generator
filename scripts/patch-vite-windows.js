import fs from "node:fs";
import path from "node:path";

const target = path.resolve("node_modules/vite/dist/node/chunks/config.js");

if (!fs.existsSync(target)) {
  process.exit(0);
}

const source = fs.readFileSync(target, "utf8");
const needle = 'exec("net use", (error$1, stdout) => {';

if (!source.includes(needle)) {
  process.exit(0);
}

const replacement = `try {
\texec("net use", (error$1, stdout) => {`;

const closureNeedle = `\t\tif (windowsNetworkMap.size === 0) safeRealpathSync = fs.realpathSync.native;
\t\telse safeRealpathSync = windowsMappedRealpathSync;
\t});
}`;

if (!source.includes(closureNeedle)) {
  process.exit(0);
}

const patchedClosure = `\t\tif (windowsNetworkMap.size === 0) safeRealpathSync = fs.realpathSync.native;
\t\telse safeRealpathSync = windowsMappedRealpathSync;
\t});
\t} catch {
\t\tsafeRealpathSync = fs.realpathSync.native;
\t}
}`;

const updated = source.replace(needle, replacement).replace(closureNeedle, patchedClosure);

if (updated !== source) {
  fs.writeFileSync(target, updated, "utf8");
}
