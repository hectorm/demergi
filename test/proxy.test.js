import http from "node:http";
import https from "node:https";
import { DemergiProxy } from "../src/proxy.js";
import { DemergiResolver } from "../src/resolver.js";

jest.setTimeout(30000);
global.console.error = jest.fn();

const proxy = new DemergiProxy({
  addrs: ["localhost:0", "[::1]:0", "127.0.0.1:0"],
});

const makeProxiedHttpsRequest = ({ proxy, host, port } = {}) => {
  const server = proxy.servers.values().next().value;
  const { address: proxyHost, port: proxyPort } = server.address();

  return new Promise((resolve, reject) => {
    http
      .request({
        host: proxyHost,
        port: proxyPort,
        method: "CONNECT",
        path: port ? `${host}:${port}` : host,
      })
      .on("connect", (_, socket) => {
        https
          .request({
            host,
            port: port || 443,
            method: "HEAD",
            path: "/",
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
  });
};

const makeProxiedHttpRequest = ({ proxy, host, port } = {}) => {
  const server = proxy.servers.values().next().value;
  const { address: proxyHost, port: proxyPort } = server.address();

  return new Promise((resolve, reject) => {
    http
      .request({
        host: proxyHost,
        port: proxyPort,
        method: "HEAD",
        path: port ? `http://${host}:${port}` : `http://${host}`,
      })
      .on("response", (res) => {
        res.on("data", () => {});
        res.on("end", () => resolve(res));
      })
      .on("error", reject)
      .end();
  });
};

beforeAll(async () => {
  await proxy.start();
});

afterAll(async () => {
  await proxy.stop();
});

describe("Proxy", () => {
  test("Must have specific defaults", () => {
    const defaults = new DemergiProxy();

    expect(defaults.happyEyeballs).toBe(true);
    expect(defaults.resolver).toBeInstanceOf(DemergiResolver);
  });

  test("Must be listening on all addresses", () => {
    expect(proxy.servers.size).toBe(3);
    for (const server of proxy.servers) {
      expect(server.listening).toBe(true);
    }
  });

  test("Must establish an HTTPS connection to a valid domain", async () => {
    const res = await makeProxiedHttpsRequest({
      proxy,
      host: "cloudflare-dns.com",
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);
  });

  test("Must establish an HTTPS connection to a valid domain and port", async () => {
    const res = await makeProxiedHttpsRequest({
      proxy,
      host: "cloudflare-dns.com",
      port: 443,
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);
  });

  test("Must establish an HTTPS connection to a valid IP address", async () => {
    const res = await makeProxiedHttpsRequest({
      proxy,
      host: "1.0.0.1",
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);
  });

  test("Must establish an HTTPS connection to a valid IP address and port", async () => {
    const res = await makeProxiedHttpsRequest({
      proxy,
      host: "1.0.0.1",
      port: 443,
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);
  });

  test("Must establish an HTTP connection to a valid domain", async () => {
    const res = await makeProxiedHttpRequest({
      proxy,
      host: "cloudflare-dns.com",
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);
  });

  test("Must establish an HTTP connection to a valid domain and port", async () => {
    const res = await makeProxiedHttpRequest({
      proxy,
      host: "cloudflare-dns.com",
      port: 80,
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);
  });

  test("Must establish an HTTP connection to a valid IP address", async () => {
    const res = await makeProxiedHttpRequest({
      proxy,
      host: "1.0.0.1",
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);
  });

  test("Must establish an HTTP connection to a valid IP address and port", async () => {
    const res = await makeProxiedHttpRequest({
      proxy,
      host: "1.0.0.1",
      port: 80,
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);
  });

  test("Must throw an exception for an HTTPS request to an invalid domain", async () => {
    await expect(
      makeProxiedHttpsRequest({
        proxy,
        host: "example.invalid",
      })
    ).rejects.toMatchObject({
      code: "ECONNRESET",
    });
  });

  test("Must throw an exception for an HTTPS request to an invalid domain and port", async () => {
    await expect(
      makeProxiedHttpsRequest({
        proxy,
        host: "example.invalid",
        port: 443,
      })
    ).rejects.toMatchObject({
      code: "ECONNRESET",
    });
  });

  test("Must throw an exception for an HTTPS request to an invalid IP address", async () => {
    await expect(
      makeProxiedHttpsRequest({
        proxy,
        host: "300.300.300.300",
      })
    ).rejects.toMatchObject({
      code: "ECONNRESET",
    });
  });

  test("Must throw an exception for an HTTPS request to an invalid IP address and port", async () => {
    await expect(
      makeProxiedHttpsRequest({
        proxy,
        host: "300.300.300.300",
        port: 443,
      })
    ).rejects.toMatchObject({
      code: "ECONNRESET",
    });
  });

  test("Must throw an exception for an HTTP request to an invalid domain", async () => {
    await expect(
      makeProxiedHttpRequest({
        proxy,
        host: "example.invalid",
      })
    ).rejects.toMatchObject({
      code: "ECONNRESET",
    });
  });

  test("Must throw an exception for an HTTP request to an invalid domain and port", async () => {
    await expect(
      makeProxiedHttpRequest({
        proxy,
        host: "example.invalid",
        port: 80,
      })
    ).rejects.toMatchObject({
      code: "ECONNRESET",
    });
  });

  test("Must throw an exception for an HTTP request to an invalid IP address", async () => {
    await expect(
      makeProxiedHttpRequest({
        proxy,
        host: "300.300.300.300",
      })
    ).rejects.toMatchObject({
      code: "ECONNRESET",
    });
  });

  test("Must throw an exception for an HTTP request to an invalid IP address and port", async () => {
    await expect(
      makeProxiedHttpRequest({
        proxy,
        host: "300.300.300.300",
        port: 80,
      })
    ).rejects.toMatchObject({
      code: "ECONNRESET",
    });
  });
});
