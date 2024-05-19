#!/usr/bin/env node

import child_process from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import url from "node:url";

import postject from "postject";

const resolve = (spec) => {
  return url.fileURLToPath(import.meta.resolve(spec));
};

const execCmd = (cmd, args) => {
  const { status } = child_process.spawnSync(cmd, args, { stdio: "inherit" });
  if (status !== 0) process.exit(status ?? 1);
};

const existsCmd = (cmd) => {
  return (
    (os.platform() !== "win32"
      ? child_process.spawnSync("command", ["-v", cmd], { shell: true })
      : child_process.spawnSync("where", [cmd])
    )?.status === 0
  );
};

const seaNode = process.env.SEA_NODE ?? process.execPath;
const seaPlatform = process.env.SEA_PLATFORM ?? os.platform();
const seaArch = process.env.SEA_ARCH ?? os.arch();
const seaExt = process.env.SEA_EXT ?? path.extname(seaNode);
const seaCfg = resolve("./sea-config.json");
const seaBlob = resolve("./dist/demergi.blob");
const seaExe = resolve(`./dist/demergi-${seaPlatform}-${seaArch}${seaExt}`);

console.log("+ Generating the blob to be injected");
execCmd(seaNode, ["--experimental-sea-config", seaCfg]);

console.log("+ Copying the Node.js binary");
await fs.copyFile(seaNode, seaExe);

if (os.platform() === "win32") {
  let signtool;
  if (existsCmd("signtool")) {
    signtool = "signtool";
  } else {
    try {
      const sdkDir = "C:/Program Files (x86)/Windows Kits/10/";
      await fs.access(sdkDir);
      signtool = path.join(sdkDir, "App Certification Kit", "signtool.exe");
      // eslint-disable-next-line
    } catch (_) {}
  }
  if (signtool) {
    console.log("+ Removing the signature with signtool");
    execCmd(signtool, ["remove", "/s", seaExe]);
  }
} else if (os.platform() === "darwin" && existsCmd("codesign")) {
  console.log("+ Removing the signature with codesign");
  execCmd("codesign", ["--remove-signature", seaExe]);
}

console.log("+ Injecting the blob into the copied Node.js binary");
await postject.inject(seaExe, "NODE_SEA_BLOB", await fs.readFile(seaBlob), {
  sentinelFuse: "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
  machoSegmentName: "NODE_SEA",
  overwrite: true,
});

console.log("+ Testing the final binary");
execCmd(seaExe, ["--version"]);
