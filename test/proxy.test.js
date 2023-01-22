import http from "node:http";
import https from "node:https";
import { DemergiProxy } from "../src/proxy.js";

global.console.error = jest.fn();

const proxy = new DemergiProxy({
  addr: "127.0.0.1",
  port: 0,
});

const makeProxiedHttpsRequest = ({ proxyHost, proxyPort, host, port } = {}) => {
  return new Promise((resolve, reject) => {
    http
      .request({
        host: proxyHost,
        port: proxyPort,
        method: "CONNECT",
        path: port ? `${host}:${port}` : host,
      })
      .on("connect", (proxyRes, socket) => {
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

const makeProxiedHttpRequest = ({ proxyHost, proxyPort, host, port } = {}) => {
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

    expect(defaults.addr).toBe("::");
    expect(defaults.port).toBe(8080);
    expect(defaults.happyEyeballs).toBe(false);
    expect(defaults.resolver).toBeDefined();
  });

  test("Must be listening on the expected port", () => {
    expect(proxy.server.listening).toBe(true);
    expect(proxy.server.address()).toMatchObject({
      address: proxy.addr,
      port: proxy.port,
    });
  });

  test("Must establish an HTTPS connection to a valid domain", async () => {
    const res = await makeProxiedHttpsRequest({
      proxyHost: proxy.addr,
      proxyPort: proxy.port,
      host: "cloudflare-dns.com",
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);
  });

  test("Must establish an HTTPS connection to a valid domain and port", async () => {
    const res = await makeProxiedHttpsRequest({
      proxyHost: proxy.addr,
      proxyPort: proxy.port,
      host: "cloudflare-dns.com",
      port: 443,
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);
  });

  test("Must establish an HTTPS connection to a valid IP address", async () => {
    const res = await makeProxiedHttpsRequest({
      proxyHost: proxy.addr,
      proxyPort: proxy.port,
      host: "1.0.0.1",
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);
  });

  test("Must establish an HTTPS connection to a valid IP address and port", async () => {
    const res = await makeProxiedHttpsRequest({
      proxyHost: proxy.addr,
      proxyPort: proxy.port,
      host: "1.0.0.1",
      port: 443,
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);
  });

  test("Must establish an HTTP connection to a valid domain", async () => {
    const res = await makeProxiedHttpRequest({
      proxyHost: proxy.addr,
      proxyPort: proxy.port,
      host: "cloudflare-dns.com",
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);
  });

  test("Must establish an HTTP connection to a valid domain and port", async () => {
    const res = await makeProxiedHttpRequest({
      proxyHost: proxy.addr,
      proxyPort: proxy.port,
      host: "cloudflare-dns.com",
      port: 80,
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);
  });

  test("Must establish an HTTP connection to a valid IP address", async () => {
    const res = await makeProxiedHttpRequest({
      proxyHost: proxy.addr,
      proxyPort: proxy.port,
      host: "1.0.0.1",
    });

    expect(res.complete).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(400);
  });

  test("Must establish an HTTP connection to a valid IP address and port", async () => {
    const res = await makeProxiedHttpRequest({
      proxyHost: proxy.addr,
      proxyPort: proxy.port,
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
        proxyHost: proxy.addr,
        proxyPort: proxy.port,
        host: "example.invalid",
      })
    ).rejects.toThrow();
  });

  test("Must throw an exception for an HTTPS request to an invalid domain and port", async () => {
    await expect(
      makeProxiedHttpsRequest({
        proxyHost: proxy.addr,
        proxyPort: proxy.port,
        host: "example.invalid",
        port: 443,
      })
    ).rejects.toThrow();
  });

  test("Must throw an exception for an HTTPS request to an invalid IP address", async () => {
    await expect(
      makeProxiedHttpsRequest({
        proxyHost: proxy.addr,
        proxyPort: proxy.port,
        host: "300.300.300.300",
      })
    ).rejects.toThrow();
  });

  test("Must throw an exception for an HTTPS request to an invalid IP address and port", async () => {
    await expect(
      makeProxiedHttpsRequest({
        proxyHost: proxy.addr,
        proxyPort: proxy.port,
        host: "300.300.300.300",
        port: 443,
      })
    ).rejects.toThrow();
  });

  test("Must throw an exception for an HTTP request to an invalid domain", async () => {
    await expect(
      makeProxiedHttpRequest({
        proxyHost: proxy.addr,
        proxyPort: proxy.port,
        host: "example.invalid",
      })
    ).rejects.toThrow();
  });

  test("Must throw an exception for an HTTP request to an invalid domain and port", async () => {
    await expect(
      makeProxiedHttpRequest({
        proxyHost: proxy.addr,
        proxyPort: proxy.port,
        host: "example.invalid",
        port: 80,
      })
    ).rejects.toThrow();
  });

  test("Must throw an exception for an HTTP request to an invalid IP address", async () => {
    await expect(
      makeProxiedHttpRequest({
        proxyHost: proxy.addr,
        proxyPort: proxy.port,
        host: "300.300.300.300",
      })
    ).rejects.toThrow();
  });

  test("Must throw an exception for an HTTP request to an invalid IP address and port", async () => {
    await expect(
      makeProxiedHttpRequest({
        proxyHost: proxy.addr,
        proxyPort: proxy.port,
        host: "300.300.300.300",
        port: 80,
      })
    ).rejects.toThrow();
  });
});
