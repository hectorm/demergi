#!/usr/bin/env node

import cluster from "cluster";
import { DemergiProxy } from "../src/proxy.js";
import {
  DemergiResolver,
  DemergiResolverMaster,
  DemergiResolverWorker,
} from "../src/resolver.js";

const config = {
  host: process.env.PROXY_HOST || "::",
  port: Number.parseInt(process.env.PROXY_PORT, 10) || 8080,
  dnsMode: process.env.PROXY_DNS_MODE || "dot",
  dnsCacheSize: Number.parseInt(process.env.PROXY_DNS_CACHE_SIZE, 10) || 100000,
  dotHost: process.env.PROXY_DOT_HOST || "1.1.1.1",
  dotPort: Number.parseInt(process.env.PROXY_DOT_PORT) || 853,
  dotTlsServername: process.env.PROXY_DOT_TLS_HOSTNAME || null,
  dotTlsPin: process.env.PROXY_DOT_PIN || null,
  workers: Number.parseInt(process.env.PROXY_WORKERS, 10) || 0,
};

const argv = process.argv.slice(2);
getopts: for (let i = 0; i < argv.length; i++) {
  switch (argv[i]) {
    case "-H":
    case "--host":
      config.host = argv[++i];
      break;
    case "-P":
    case "--port":
      config.port = Number.parseInt(argv[++i], 10);
      break;
    case "-W":
    case "--workers":
      config.workers = Number.parseInt(argv[++i], 10);
      break;
    case "--dns-mode":
      config.dnsMode = argv[++i];
      break;
    case "--dns-cache-size":
      config.dnsCacheSize = Number.parseInt(argv[++i], 10);
      break;
    case "--dot-host":
      config.dotHost = argv[++i];
      break;
    case "--dot-port":
      config.dotPort = Number.parseInt(argv[++i], 10);
      break;
    case "--dot-tls-servername":
      config.dotTlsServername = argv[++i];
      break;
    case "--dot-tls-pin":
      config.dotTlsPin = argv[++i];
      break;
    case "-v":
    case "--version":
      console.log(`Demergi 0.0.0`);
      process.exit(0);
      break;
    case "-h":
    case "--help":
      console.log(
        [
          `Usage: demergi [OPTION]...\n\n`,
          `A proxy server that helps to bypass the DPI systems implemented by various ISPs.\n`,
          `\nProxy:\n`,
          `  -H, --host STR            The host to bind the server to ("::" by default).\n`,
          `  -P, --port NUM            The port to bind the server to (8080 by default).\n`,
          `  -W, --workers NUM         The number of workers (0 by default).\n`,
          `\nResolver:\n`,
          `  --dns-mode STR            The DNS resolver mode, valid values are "plain" and\n`,
          `                              "dot" ("dot" by default).\n`,
          `  --dns-cache-size NUM      The maximum number of entries in the DNS cache\n`,
          `                              (100000 by default).\n`,
          `  --dot-host STR            The DoT server host ("1.1.1.1" by default).\n`,
          `  --dot-port NUM            The DoT server port (853 by default).\n`,
          `  --dot-tls-servername STR  The server name to check in the DoT server\n`,
          `                              certificate (unspecified by default).\n`,
          `  --dot-tls-pin STR         The pin to check in the DoT server certificate.\n`,
          `                              The pin must be a base64 encoded SHA256 hash of\n`,
          `                              the public key (unspecified by default).\n`,
          `\nStartup:\n`,
          `  -v, --version             Show version and quit.\n`,
          `  -h, --help                Show this help and quit.\n`,
        ].join("")
      );
      process.exit(0);
      break;
    case "--":
      break getopts;
    default:
      console.log(
        [
          `Illegal option "${argv[i]}".\n`,
          `Try "--help" for usage information.`,
        ].join("")
      );
      process.exit(1);
  }
}

const resolverOptions = {
  dnsMode: config.dnsMode,
  dnsCacheSize: config.dnsCacheSize,
  dotHost: config.dotHost,
  dotPort: config.dotPort,
  dotTlsServername: config.dotTlsServername,
  dotTlsPin: config.dotTlsPin,
};

if (config.workers > 0 && cluster.isPrimary) {
  cluster.on("online", (worker) => {
    console.log(`Worker ${worker.process.pid} started`);
  });

  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died (${signal || code})`);
  });

  const resolver = new DemergiResolverMaster(resolverOptions);

  for (let i = 0; i < config.workers; i++) {
    const worker = cluster.fork();
    resolver.addMessageListener(worker);
  }
} else {
  const proxy = new DemergiProxy({
    host: config.host,
    port: config.port,
    resolver: cluster.isWorker
      ? new DemergiResolverWorker()
      : new DemergiResolver(resolverOptions),
  });

  await proxy.start();
  console.log(`Listening on ${proxy.host}:${proxy.port}`);

  process.on("SIGINT", async () => await proxy.stop());
  process.on("SIGTERM", async () => await proxy.stop());
}
