import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { DemergiProxy } from "../src/proxy.js";
import { DemergiResolver } from "../src/resolver.js";
import {
  TEST_TLS_CA_CERT,
  TEST_TLS_SERVER_KEY,
  TEST_TLS_SERVER_CERT,
  TEST_TLS_SERVER_EXPIRED_CERT,
  TEST_TLS_CLIENT_KEY,
  TEST_TLS_CLIENT_CERT,
  TEST_TLS_CLIENT_EXPIRED_CERT,
  TEST_TLS_CLIENT_INVALID_CERT,
  TEST_TLS_MALFORMED_KEY,
  TEST_TLS_MALFORMED_CERT,
} from "./proxy.certs.js";

jest.setTimeout(30000);
global.console.error = jest.fn();

const httpProxyRequest = ({
  proxy,
  protocol,
  host,
  port,
  path = "",
  options,
} = {}) => {
  return new Promise((resolve, reject) => {
    const server = proxy.servers.values().next().value;
    const httpModule = server instanceof tls.Server ? https : http;
    const { address: proxyHost, port: proxyPort } = server.address();

    let origin = net.isIPv6(host) ? `[${host}]` : host;
    if (port) origin += `:${port}`;

    if (protocol === "https:") {
      httpModule
        .request({
          host: proxyHost,
          port: proxyPort,
          method: "CONNECT",
          path: origin,
          ...options,
        })
        .on("connect", (_, socket) => {
          https
            .request({
              host,
              port: port || 443,
              method: "HEAD",
              path,
              agent: new https.Agent({ socket }),
            })
            .on("response", (res) => {
              res.resume();
              res.on("end", () => resolve(res));
            })
            .on("error", reject)
            .end();
        })
        .on("error", reject)
        .end();
    } else {
      httpModule
        .request({
          host: proxyHost,
          port: proxyPort,
          method: "HEAD",
          path: `http://${origin}${path}`,
          ...options,
        })
        .on("response", (res) => {
          res.on("data", () => {});
          res.on("end", () => resolve(res));
        })
        .on("error", reject)
        .end();
    }
  });
};

describe("Proxy", () => {
  test("Must have specific defaults", () => {
    const proxy = new DemergiProxy();

    expect(proxy.happyEyeballs).toBe(false);
    expect(proxy.resolver).toBeInstanceOf(DemergiResolver);
  });

  test("Must start and stop", async () => {
    const proxy = new DemergiProxy({
      addrs: [
        "localhost:0",
        "127.0.0.1:0",
        "http://localhost:0",
        "http://127.0.0.1:0",
        "https://localhost:0",
        "https://127.0.0.1:0",
      ],
      tlsKey: TEST_TLS_SERVER_KEY,
      tlsCert: TEST_TLS_SERVER_CERT,
    });

    await proxy.start();

    expect(proxy.servers.size).toBe(6);
    for (const server of proxy.servers) {
      expect(server.listening).toBe(true);
    }

    await proxy.stop();

    expect(proxy.servers.size).toBe(0);
  });

  test("Must establish an HTTPS connection to a valid domain through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    await proxy.start();

    const res = await httpProxyRequest({
      proxy,
      protocol: "https:",
      host: "cloudflare-dns.com",
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);

    await proxy.stop();
  });

  test("Must establish an HTTPS connection to a valid domain and port through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    await proxy.start();

    const res = await httpProxyRequest({
      proxy,
      protocol: "https:",
      host: "cloudflare-dns.com",
      port: 443,
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);

    await proxy.stop();
  });

  test("Must establish an HTTPS connection to a valid IP address through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    await proxy.start();

    const res = await httpProxyRequest({
      proxy,
      protocol: "https:",
      host: "1.0.0.1",
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);

    await proxy.stop();
  });

  test("Must establish an HTTPS connection to a valid IP address and port through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    await proxy.start();

    const res = await httpProxyRequest({
      proxy,
      protocol: "https:",
      host: "1.0.0.1",
      port: 443,
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);

    await proxy.stop();
  });

  test("Must throw an exception for an HTTPS request to an invalid domain through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    await proxy.start();

    await expect(
      httpProxyRequest({
        proxy,
        protocol: "https:",
        host: "example.invalid",
      }),
    ).rejects.toMatchObject({
      code: "ECONNRESET",
    });

    await proxy.stop();
  });

  test("Must throw an exception for an HTTPS request to an invalid domain and port through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    await proxy.start();

    await expect(
      httpProxyRequest({
        proxy,
        protocol: "https:",
        host: "example.invalid",
        port: 443,
      }),
    ).rejects.toMatchObject({
      code: "ECONNRESET",
    });

    await proxy.stop();
  });

  test("Must throw an exception for an HTTPS request to an invalid IP address through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    await proxy.start();

    await expect(
      httpProxyRequest({
        proxy,
        protocol: "https:",
        host: "300.300.300.300",
      }),
    ).rejects.toMatchObject({
      code: "ECONNRESET",
    });

    await proxy.stop();
  });

  test("Must throw an exception for an HTTPS request to an invalid IP address and port through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    await proxy.start();

    await expect(
      httpProxyRequest({
        proxy,
        protocol: "https:",
        host: "300.300.300.300",
        port: 443,
      }),
    ).rejects.toMatchObject({
      code: "ECONNRESET",
    });

    await proxy.stop();
  });

  test("Must establish an HTTP connection to a valid domain through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    await proxy.start();

    const res = await httpProxyRequest({
      proxy,
      protocol: "http:",
      host: "cloudflare-dns.com",
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);

    await proxy.stop();
  });

  test("Must establish an HTTP connection to a valid domain and port through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    await proxy.start();

    const res = await httpProxyRequest({
      proxy,
      protocol: "http:",
      host: "cloudflare-dns.com",
      port: 80,
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);

    await proxy.stop();
  });

  test("Must establish an HTTP connection to a valid IP address through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    await proxy.start();

    const res = await httpProxyRequest({
      proxy,
      protocol: "http:",
      host: "1.0.0.1",
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);

    await proxy.stop();
  });

  test("Must establish an HTTP connection to a valid IP address and port through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    await proxy.start();

    const res = await httpProxyRequest({
      proxy,
      protocol: "http:",
      host: "1.0.0.1",
      port: 80,
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);

    await proxy.stop();
  });

  test("Must throw an exception for an HTTP request to an invalid domain through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    await proxy.start();

    await expect(
      httpProxyRequest({
        proxy,
        protocol: "http:",
        host: "example.invalid",
      }),
    ).rejects.toMatchObject({
      code: "ECONNRESET",
    });

    await proxy.stop();
  });

  test("Must throw an exception for an HTTP request to an invalid domain and port through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    await proxy.start();

    await expect(
      httpProxyRequest({
        proxy,
        protocol: "http:",
        host: "example.invalid",
        port: 80,
      }),
    ).rejects.toMatchObject({
      code: "ECONNRESET",
    });

    await proxy.stop();
  });

  test("Must throw an exception for an HTTP request to an invalid IP address through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    await proxy.start();

    await expect(
      httpProxyRequest({
        proxy,
        protocol: "http:",
        host: "300.300.300.300",
      }),
    ).rejects.toMatchObject({
      code: "ECONNRESET",
    });

    await proxy.stop();
  });

  test("Must throw an exception for an HTTP request to an invalid IP address and port through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    await proxy.start();

    await expect(
      httpProxyRequest({
        proxy,
        protocol: "http:",
        host: "300.300.300.300",
        port: 80,
      }),
    ).rejects.toMatchObject({
      code: "ECONNRESET",
    });

    await proxy.stop();
  });

  test("Must establish an HTTPS connection through an HTTPS proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsKey: TEST_TLS_SERVER_KEY,
      tlsCert: TEST_TLS_SERVER_CERT,
    });

    await proxy.start();

    const res = await httpProxyRequest({
      proxy,
      protocol: "https:",
      host: "cloudflare-dns.com",
      options: {
        ca: TEST_TLS_CA_CERT,
      },
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);

    await proxy.stop();
  });

  test("Must establish an HTTPS connection through an HTTPS proxy with mTLS", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsCa: TEST_TLS_CA_CERT,
      tlsKey: TEST_TLS_SERVER_KEY,
      tlsCert: TEST_TLS_SERVER_CERT,
    });

    await proxy.start();

    const res = await httpProxyRequest({
      proxy,
      protocol: "https:",
      host: "cloudflare-dns.com",
      options: {
        ca: TEST_TLS_CA_CERT,
        key: TEST_TLS_CLIENT_KEY,
        cert: TEST_TLS_CLIENT_CERT,
      },
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);

    await proxy.stop();
  });

  test("Must establish an HTTP connection through an HTTPS proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsKey: TEST_TLS_SERVER_KEY,
      tlsCert: TEST_TLS_SERVER_CERT,
    });

    await proxy.start();

    const res = await httpProxyRequest({
      proxy,
      protocol: "http:",
      host: "cloudflare-dns.com",
      options: {
        ca: TEST_TLS_CA_CERT,
      },
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);

    await proxy.stop();
  });

  test("Must establish an HTTP connection through an HTTPS proxy with mTLS", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsCa: TEST_TLS_CA_CERT,
      tlsKey: TEST_TLS_SERVER_KEY,
      tlsCert: TEST_TLS_SERVER_CERT,
    });

    await proxy.start();

    const res = await httpProxyRequest({
      proxy,
      protocol: "http:",
      host: "cloudflare-dns.com",
      options: {
        ca: TEST_TLS_CA_CERT,
        key: TEST_TLS_CLIENT_KEY,
        cert: TEST_TLS_CLIENT_CERT,
      },
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);

    await proxy.stop();
  });

  test("Must throw an exception when starting an HTTPS proxy with a malformed server key", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsKey: TEST_TLS_MALFORMED_KEY,
      tlsCert: TEST_TLS_SERVER_CERT,
    });

    await expect(proxy.start()).rejects.toMatchObject({
      code: expect.stringMatching(/^(ECONNRESET|ERR_O?SSL_[0-9A-Z_]+)$/),
    });

    await proxy.stop();
  });

  test("Must throw an exception when starting an HTTPS proxy with a malformed server certificate", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsKey: TEST_TLS_SERVER_KEY,
      tlsCert: TEST_TLS_MALFORMED_CERT,
    });

    await expect(proxy.start()).rejects.toMatchObject({
      code: expect.stringMatching(/^(ECONNRESET|ERR_O?SSL_[0-9A-Z_]+)$/),
    });

    await proxy.stop();
  });

  test("Must throw an exception for an HTTPS request through an HTTPS proxy with a malformed CA certificate bundle", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsCa: TEST_TLS_MALFORMED_CERT,
      tlsKey: TEST_TLS_SERVER_KEY,
      tlsCert: TEST_TLS_SERVER_CERT,
    });

    await proxy.start();

    await expect(
      httpProxyRequest({
        proxy,
        protocol: "https:",
        host: "cloudflare-dns.com",
        options: {
          ca: TEST_TLS_CA_CERT,
          key: TEST_TLS_CLIENT_KEY,
          cert: TEST_TLS_CLIENT_CERT,
        },
      }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/^(ECONNRESET|ERR_O?SSL_[0-9A-Z_]+)$/),
    });

    await proxy.stop();
  });

  test("Must throw an exception for an HTTPS request through an HTTPS proxy without a server certificate", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
    });

    await proxy.start();

    await expect(
      httpProxyRequest({
        proxy,
        protocol: "https:",
        host: "cloudflare-dns.com",
        options: {
          ca: TEST_TLS_CA_CERT,
        },
      }),
    ).rejects.toMatchObject({
      code: "EPROTO",
    });

    await proxy.stop();
  });

  test("Must throw an exception for an HTTPS request through an HTTPS proxy with an expired server certificate", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsKey: TEST_TLS_SERVER_KEY,
      tlsCert: TEST_TLS_SERVER_EXPIRED_CERT,
    });

    await proxy.start();

    await expect(
      httpProxyRequest({
        proxy,
        protocol: "https:",
        host: "cloudflare-dns.com",
        options: {
          ca: TEST_TLS_CA_CERT,
        },
      }),
    ).rejects.toMatchObject({
      code: "CERT_HAS_EXPIRED",
    });

    await proxy.stop();
  });

  test("Must throw an exception for an HTTPS request through an HTTPS proxy with an untrusted server certificate", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsKey: TEST_TLS_SERVER_KEY,
      tlsCert: TEST_TLS_SERVER_CERT,
    });

    await proxy.start();

    await expect(
      httpProxyRequest({
        proxy,
        protocol: "https:",
        host: "cloudflare-dns.com",
      }),
    ).rejects.toMatchObject({
      code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    });

    await proxy.stop();
  });

  test("Must throw an exception for an HTTPS request through an HTTPS proxy without a client certificate", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsCa: TEST_TLS_CA_CERT,
      tlsKey: TEST_TLS_SERVER_KEY,
      tlsCert: TEST_TLS_SERVER_CERT,
    });

    await proxy.start();

    await expect(
      httpProxyRequest({
        proxy,
        protocol: "https:",
        host: "cloudflare-dns.com",
        options: {
          ca: TEST_TLS_CA_CERT,
        },
      }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/^(ECONNRESET|ERR_O?SSL_[0-9A-Z_]+)$/),
    });

    await proxy.stop();
  });

  test("Must throw an exception for an HTTPS request through an HTTPS proxy with an expired client certificate", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsCa: TEST_TLS_CA_CERT,
      tlsKey: TEST_TLS_SERVER_KEY,
      tlsCert: TEST_TLS_SERVER_CERT,
    });

    await proxy.start();

    await expect(
      httpProxyRequest({
        proxy,
        protocol: "https:",
        host: "cloudflare-dns.com",
        options: {
          ca: TEST_TLS_CA_CERT,
          key: TEST_TLS_CLIENT_KEY,
          cert: TEST_TLS_CLIENT_EXPIRED_CERT,
        },
      }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/^(ECONNRESET|ERR_O?SSL_[0-9A-Z_]+)$/),
    });

    await proxy.stop();
  });

  test("Must throw an exception for an HTTPS request through an HTTPS proxy with an untrusted client certificate", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsCa: TEST_TLS_CA_CERT,
      tlsKey: TEST_TLS_SERVER_KEY,
      tlsCert: TEST_TLS_SERVER_CERT,
    });

    await proxy.start();

    await expect(
      httpProxyRequest({
        proxy,
        protocol: "https:",
        host: "cloudflare-dns.com",
        options: {
          ca: TEST_TLS_CA_CERT,
          key: TEST_TLS_CLIENT_KEY,
          cert: TEST_TLS_CLIENT_INVALID_CERT,
        },
      }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/^(ECONNRESET|ERR_O?SSL_[0-9A-Z_]+)$/),
    });

    await proxy.stop();
  });
});
