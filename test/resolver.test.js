import net from "node:net";
import { DemergiResolver } from "../src/resolver.js";
import {
  ResolverCertificatePINError,
  ResolverNoAddressError,
} from "../src/errors.js";

global.console.error = jest.fn();

describe("Resolver", () => {
  test("Must have specific defaults", () => {
    const defaults = new DemergiResolver();

    expect(defaults.dnsMode).toBe("dot");
    expect(defaults.dnsCache.max).toBe(100000);
    expect(defaults.dotHost).toBe("1.0.0.1");
    expect(defaults.dotPort).toBe(853);
    expect(defaults.dotTlsServername).toBeUndefined();
    expect(defaults.dotTlsPin).toBeUndefined();
  });

  test("Must resolve google.com to an IPv6 and IPv4 address in plain DNS mode", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "plain",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must resolve ipv6.google.com to an IPv6 address in plain DNS mode", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "plain",
    });

    const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(ipB).toBeUndefined();
  });

  test("Must resolve ipv4.google.com to an IPv4 address in plain DNS mode", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "plain",
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    expect(net.isIPv4(ipA.address)).toBe(true);
    expect(ipA.family).toBe(4);
    expect(ipB).toBeUndefined();
  });

  test("Must throw an exception in plain DNS mode for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "plain",
    });

    await expect(resolver.resolve("google.invalid")).rejects.toThrow(
      ResolverNoAddressError
    );
  });

  test("Must resolve google.com to an IPv6 and IPv4 address in DoT mode using Cloudflare DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.0.0.1",
      dotTlsServername: "cloudflare-dns.com",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must resolve ipv6.google.com to an IPv6 address in DoT mode using Cloudflare DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.0.0.1",
      dotTlsServername: "cloudflare-dns.com",
    });

    const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(ipB).toBeUndefined();
  });

  test("Must resolve ipv4.google.com to an IPv4 address in DoT mode using Cloudflare DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.0.0.1",
      dotTlsServername: "cloudflare-dns.com",
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    expect(net.isIPv4(ipA.address)).toBe(true);
    expect(ipA.family).toBe(4);
    expect(ipB).toBeUndefined();
  });

  test("Must resolve google.com to an IPv6 and IPv4 address in DoT mode using Google DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "8.8.8.8",
      dotTlsServername: "dns.google",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must resolve ipv6.google.com to an IPv6 address in DoT mode using Google DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "8.8.8.8",
      dotTlsServername: "dns.google",
    });

    const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(ipB).toBeUndefined();
  });

  test("Must resolve ipv4.google.com to an IPv4 address in DoT mode using Google DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "8.8.8.8",
      dotTlsServername: "dns.google",
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    expect(net.isIPv4(ipA.address)).toBe(true);
    expect(ipA.family).toBe(4);
    expect(ipB).toBeUndefined();
  });

  test("Must resolve google.com to an IPv6 and IPv4 address in DoT mode using Quad9 DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "9.9.9.9",
      dotTlsServername: "dns.quad9.net",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must resolve ipv6.google.com to an IPv6 address in DoT mode using Quad9 DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "9.9.9.9",
      dotTlsServername: "dns.quad9.net",
    });

    const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(ipB).toBeUndefined();
  });

  test("Must resolve ipv4.google.com to an IPv4 address in DoT mode using Quad9 DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "9.9.9.9",
      dotTlsServername: "dns.quad9.net",
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    expect(net.isIPv4(ipA.address)).toBe(true);
    expect(ipA.family).toBe(4);
    expect(ipB).toBeUndefined();
  });

  test("Must resolve google.com to an IPv6 and IPv4 address in DoT mode using AdGuard DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "dns.adguard.com",
      dotTlsServername: "dns.adguard.com",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must resolve ipv6.google.com to an IPv6 address in DoT mode using AdGuard DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "dns.adguard.com",
      dotTlsServername: "dns.adguard.com",
    });

    const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(ipB).toBeUndefined();
  });

  test("Must resolve ipv4.google.com to an IPv4 address in DoT mode using AdGuard DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "dns.adguard.com",
      dotTlsServername: "dns.adguard.com",
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    expect(net.isIPv4(ipA.address)).toBe(true);
    expect(ipA.family).toBe(4);
    expect(ipB).toBeUndefined();
  });

  test("Must resolve google.com to an IPv6 and IPv4 address in DoT mode using Cloudflare DNS with a valid pinned certificate", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.0.0.1",
      dotTlsPin: "xY6kq3vGPX0WsUTfUuFGdxhPEiKw0+RsBYcbr3WLpLk=",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must resolve google.com to an IPv6 and IPv4 address in DoT mode using Cloudflare DNS with a valid server name and a valid pinned certificate", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.0.0.1",
      dotTlsServername: "cloudflare-dns.com",
      dotTlsPin: "xY6kq3vGPX0WsUTfUuFGdxhPEiKw0+RsBYcbr3WLpLk=",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must throw an exception in DoT mode using Cloudflare DNS with a valid server name for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.0.0.1",
      dotTlsServername: "cloudflare-dns.com",
    });

    await expect(resolver.resolve("google.invalid")).rejects.toThrow(
      ResolverNoAddressError
    );
  });

  test("Must throw an exception in DoT mode using Google DNS with a valid server name for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "8.8.8.8",
      dotTlsServername: "dns.google",
    });

    await expect(resolver.resolve("google.invalid")).rejects.toThrow(
      ResolverNoAddressError
    );
  });

  test("Must throw an exception in DoT mode using Quad9 DNS with a valid server name for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "9.9.9.9",
      dotTlsServername: "dns.quad9.net",
    });

    await expect(resolver.resolve("google.invalid")).rejects.toThrow(
      ResolverNoAddressError
    );
  });

  test("Must throw an exception in DoT mode using AdGuard DNS with a valid server name for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "dns.adguard.com",
      dotTlsServername: "dns.adguard.com",
    });

    await expect(resolver.resolve("google.invalid")).rejects.toThrow(
      ResolverNoAddressError
    );
  });

  test("Must throw an exception in DoT mode using Cloudflare DNS with an invalid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.0.0.1",
      dotTlsServername: "cloudflare-dns.invalid",
    });

    await expect(resolver.resolve("google.com")).rejects.toMatchObject({
      code: "ERR_TLS_CERT_ALTNAME_INVALID",
      host: "cloudflare-dns.invalid",
    });
  });

  test("Must throw an exception in DoT mode using Cloudflare DNS with an invalid pinned certificate", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.0.0.1",
      dotTlsPin: "aHVudGVyMg==",
    });

    await expect(resolver.resolve("google.com")).rejects.toThrow(
      ResolverCertificatePINError
    );
  });

  test("Must throw an exception in DoT mode using Cloudflare DNS with a valid server name and an invalid pinned certificate", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.0.0.1",
      dotTlsServername: "cloudflare-dns.com",
      dotTlsPin: "aHVudGVyMg==",
    });

    await expect(resolver.resolve("google.com")).rejects.toThrow(
      ResolverCertificatePINError
    );
  });

  test("Must throw an exception in DoT mode using Cloudflare DNS with an invalid server name and a valid pinned certificate", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.0.0.1",
      dotTlsServername: "cloudflare-dns.invalid",
      dotTlsPin: "xY6kq3vGPX0WsUTfUuFGdxhPEiKw0+RsBYcbr3WLpLk=",
    });

    await expect(resolver.resolve("google.com")).rejects.toMatchObject({
      code: "ERR_TLS_CERT_ALTNAME_INVALID",
      host: "cloudflare-dns.invalid",
    });
  });

  test("Must throw an exception in DoT mode using Cloudflare DNS with an invalid server name and an invalid pinned certificate", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotHost: "1.0.0.1",
      dotTlsServername: "cloudflare-dns.invalid",
      dotTlsPin: "aHVudGVyMg==",
    });

    await expect(resolver.resolve("google.com")).rejects.toMatchObject({
      code: "ERR_TLS_CERT_ALTNAME_INVALID",
      host: "cloudflare-dns.invalid",
    });
  });
});
