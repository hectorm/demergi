import fs from "node:fs";
import process from "node:process";

export const getEnv = (name, defaultValue) => {
  return name in process.env ? process.env[name] : defaultValue;
};

export const toStr = (value) => {
  return value !== undefined ? `${value}` : undefined;
};

export const toInt = (value) => {
  return value !== undefined ? Number.parseInt(value, 10) : undefined;
};

export const toBool = (value) => {
  return value !== undefined ? `${value}`.toLowerCase() === "true" : undefined;
};

export const toList = (value) => {
  return value !== undefined ? `${value}`.split(/[\s,]+/) : undefined;
};

export const readTextFile = (path) => {
  return path !== undefined ? fs.readFileSync(path, "utf8") : undefined;
};

export const readJsonFile = (path) => {
  return path !== undefined ? JSON.parse(readTextFile(path)) : undefined;
};

export const isBun = process.versions.bun !== undefined;
