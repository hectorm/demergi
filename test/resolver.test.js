import net from "net";
import { DemergiResolver } from "../src/resolver.js";

describe("Resolver", () => {
  test("Must have specific defaults", () => {
    const defaults = new DemergiResolver();

    expect(defaults.dnsMode).toBe("dot");
    expect(defaults.dnsCache.max).toBe(100000);
    expect(defaults.dotHost).toBe("1.1.1.1");
    expect(defaults.dotPort).toBe(853);
    expect(defaults.dotTlsServername).toBeUndefined();
    expect(defaults.dotTlsPin).toBeUndefined();
  });

  test("Must resolve example.com to an IPv4 address in plain DNS mode", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "plain",
    });

    const addr = await resolver.resolve("example.com");
    expect(net.isIPv4(addr)).toBe(true);
  });

  test("Must resolve example.com to an IPv6 address in plain DNS mode", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "plain",
    });

    const addr = await resolver.resolve("example.com", 6);
    expect(net.isIPv6(addr)).toBe(true);
  });

  test("Must throw an exception in plain DNS mode for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "plain",
    });

    await expect(resolver.resolve("example.invalid")).rejects.toThrow();
  });

  test("Must resolve example.com to an IPv4 address in DoT mode using Cloudflare DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.1.1.1",
      dotTlsServername: "cloudflare-dns.com",
    });

    const addr = await resolver.resolve("example.com");
    expect(net.isIPv4(addr)).toBe(true);
  });

  test("Must resolve example.com to an IPv6 address in DoT mode using Cloudflare DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.1.1.1",
      dotTlsServername: "cloudflare-dns.com",
    });

    const addr = await resolver.resolve("example.com", 6);
    expect(net.isIPv6(addr)).toBe(true);
  });

  test("Must resolve example.com to an IPv4 address in DoT mode using Google DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "8.8.8.8",
      dotTlsServername: "dns.google",
    });

    const addr = await resolver.resolve("example.com");
    expect(net.isIPv4(addr)).toBe(true);
  });

  test("Must resolve example.com to an IPv6 address in DoT mode using Google DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "8.8.8.8",
      dotTlsServername: "dns.google",
    });

    const addr = await resolver.resolve("example.com", 6);
    expect(net.isIPv6(addr)).toBe(true);
  });

  test("Must resolve example.com to an IPv4 address in DoT mode using Quad9 DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "9.9.9.9",
      dotTlsServername: "dns.quad9.net",
    });

    const addr = await resolver.resolve("example.com");
    expect(net.isIPv4(addr)).toBe(true);
  });

  test("Must resolve example.com to an IPv6 address in DoT mode using Quad9 DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "9.9.9.9",
      dotTlsServername: "dns.quad9.net",
    });

    const addr = await resolver.resolve("example.com", 6);
    expect(net.isIPv6(addr)).toBe(true);
  });

  test("Must resolve example.com to an IPv4 address in DoT mode using Cloudflare DNS with a valid pinned certificate", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.1.1.1",
      dotTlsPin: "XdhSFdS2Zao99m31qAd/19S0SDzT2D52btXyYWqnJn4=",
    });

    const addr = await resolver.resolve("example.com");
    expect(net.isIPv4(addr)).toBe(true);
  });

  test("Must resolve example.com to an IPv4 address in DoT mode using Cloudflare DNS with a valid server name and a valid pinned certificate", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.1.1.1",
      dotTlsServername: "cloudflare-dns.com",
      dotTlsPin: "XdhSFdS2Zao99m31qAd/19S0SDzT2D52btXyYWqnJn4=",
    });

    const addr = await resolver.resolve("example.com");
    expect(net.isIPv4(addr)).toBe(true);
  });

  test("Must throw an exception in DoT mode using Cloudflare DNS with a valid server name for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.1.1.1",
      dotTlsServername: "cloudflare-dns.com",
    });

    await expect(resolver.resolve("example.invalid")).rejects.toThrow();
  });

  test("Must throw an exception in DoT mode using Google DNS with a valid server name for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "8.8.8.8",
      dotTlsServername: "dns.google",
    });

    await expect(resolver.resolve("example.invalid")).rejects.toThrow();
  });

  test("Must throw an exception in DoT mode using Quad9 DNS with a valid server name for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "9.9.9.9",
      dotTlsServername: "dns.quad9.net",
    });

    await expect(resolver.resolve("example.invalid")).rejects.toThrow();
  });

  test("Must throw an exception in DoT mode using Cloudflare DNS with an invalid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.1.1.1",
      dotTlsServername: "cloudflare-dns.invalid",
    });

    await expect(resolver.resolve("example.com")).rejects.toThrow();
  });

  test("Must throw an exception in DoT mode using Cloudflare DNS with an invalid pinned certificate", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.1.1.1",
      dotTlsPin: "aHVudGVyMg==",
    });

    await expect(resolver.resolve("example.com")).rejects.toThrow();
  });

  test("Must throw an exception in DoT mode using Cloudflare DNS with a valid server name and an invalid pinned certificate", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.1.1.1",
      dotTlsServername: "cloudflare-dns.com",
      dotTlsPin: "aHVudGVyMg==",
    });

    await expect(resolver.resolve("example.com")).rejects.toThrow();
  });

  test("Must throw an exception in DoT mode using Cloudflare DNS with an invalid server name and a valid pinned certificate", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.1.1.1",
      dotTlsServername: "cloudflare-dns.invalid",
      dotTlsPin: "XdhSFdS2Zao99m31qAd/19S0SDzT2D52btXyYWqnJn4=",
    });

    await expect(resolver.resolve("example.com")).rejects.toThrow();
  });

  test("Must throw an exception in DoT mode using Cloudflare DNS with an invalid server name and an invalid pinned certificate", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.1.1.1",
      dotTlsServername: "cloudflare-dns.invalid",
      dotTlsPin: "aHVudGVyMg==",
    });

    await expect(resolver.resolve("example.com")).rejects.toThrow();
  });
});
