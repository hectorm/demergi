import net from "node:net";
import { DemergiResolver } from "../src/resolver.js";
import {
  ResolverCertificatePINError,
  ResolverNoAddressError,
} from "../src/errors.js";

jest.setTimeout(30000);
global.console.error = jest.fn();

describe("Resolver", () => {
  test("Must have specific defaults", () => {
    const defaults = new DemergiResolver();

    expect(defaults.dnsMode).toBe("doh");
    expect(defaults.dnsCache.max).toBe(100000);
    expect(defaults.dohUrl.toString()).toBe("https://1.0.0.1/dns-query");
    expect(defaults.dohTlsServername).toBeUndefined();
    expect(defaults.dohTlsPin).toBeUndefined();
    expect(defaults.dotServer.toString()).toBe("tls://1.0.0.1");
    expect(defaults.dotTlsServername).toBeUndefined();
    expect(defaults.dotTlsPin).toBeUndefined();
  });

  // Plain

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

  // DoH - Cloudflare

  test("Must resolve google.com to an IPv6 and IPv4 address in DoH mode using Cloudflare DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://1.0.0.1/dns-query",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must resolve ipv6.google.com to an IPv6 address in DoH mode using Cloudflare DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://1.0.0.1/dns-query",
    });

    const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(ipB).toBeUndefined();
  });

  test("Must resolve ipv4.google.com to an IPv4 address in DoH mode using Cloudflare DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://1.0.0.1/dns-query",
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    expect(net.isIPv4(ipA.address)).toBe(true);
    expect(ipA.family).toBe(4);
    expect(ipB).toBeUndefined();
  });

  test("Must resolve google.com to an IPv6 and IPv4 address in DoH mode using Cloudflare DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://1.0.0.1/dns-query",
      dohTlsServername: "cloudflare-dns.com",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must resolve google.com to an IPv6 and IPv4 address in DoH mode using Cloudflare DNS with a valid pinned certificate", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://1.0.0.1/dns-query",
      dohTlsPin: "GP8Knf7qBae+aIfythytMbYnL+yowaWVeD6MoLHkVRg=",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must resolve google.com to an IPv6 and IPv4 address in DoH mode using Cloudflare DNS with a valid server name and a valid pinned certificate", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://1.0.0.1/dns-query",
      dohTlsServername: "cloudflare-dns.com",
      dohTlsPin: "GP8Knf7qBae+aIfythytMbYnL+yowaWVeD6MoLHkVRg=",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must throw an exception in DoH mode using Cloudflare DNS for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://1.0.0.1/dns-query",
    });

    await expect(resolver.resolve("google.invalid")).rejects.toThrow(
      ResolverNoAddressError
    );
  });

  test("Must throw an exception in DoH mode using Cloudflare DNS with an invalid server name for a request to a valid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://1.0.0.1/dns-query",
      dohTlsServername: "cloudflare-dns.invalid",
    });

    await expect(resolver.resolve("google.com")).rejects.toMatchObject({
      code: "ERR_TLS_CERT_ALTNAME_INVALID",
      host: "cloudflare-dns.invalid",
    });
  });

  test("Must throw an exception in DoH mode using Cloudflare DNS with an invalid pinned certificate for a request to a valid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://1.0.0.1/dns-query",
      dohTlsPin: "aHVudGVyMg==",
    });

    await expect(resolver.resolve("google.com")).rejects.toThrow(
      ResolverCertificatePINError
    );
  });

  test("Must throw an exception in DoH mode using Cloudflare DNS with a valid server name and an invalid pinned certificate for a request to a valid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://1.0.0.1/dns-query",
      dohTlsServername: "cloudflare-dns.com",
      dohTlsPin: "aHVudGVyMg==",
    });

    await expect(resolver.resolve("google.com")).rejects.toThrow(
      ResolverCertificatePINError
    );
  });

  test("Must throw an exception in DoH mode using Cloudflare DNS with an invalid server name and a valid pinned certificate for a request to a valid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://1.0.0.1/dns-query",
      dohTlsServername: "cloudflare-dns.invalid",
      dohTlsPin: "GP8Knf7qBae+aIfythytMbYnL+yowaWVeD6MoLHkVRg=",
    });

    await expect(resolver.resolve("google.com")).rejects.toMatchObject({
      code: "ERR_TLS_CERT_ALTNAME_INVALID",
      host: "cloudflare-dns.invalid",
    });
  });

  test("Must throw an exception in DoH mode using Cloudflare DNS with an invalid server name and an invalid pinned certificate for a request to a valid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://1.0.0.1/dns-query",
      dohTlsServername: "cloudflare-dns.invalid",
      dohTlsPin: "aHVudGVyMg==",
    });

    await expect(resolver.resolve("google.com")).rejects.toMatchObject({
      code: "ERR_TLS_CERT_ALTNAME_INVALID",
      host: "cloudflare-dns.invalid",
    });
  });

  // DoH - Google

  test("Must resolve google.com to an IPv6 and IPv4 address in DoH mode using Google DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://8.8.8.8/dns-query",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must resolve ipv6.google.com to an IPv6 address in DoH mode using Google DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://8.8.8.8/dns-query",
    });

    const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(ipB).toBeUndefined();
  });

  test("Must resolve ipv4.google.com to an IPv4 address in DoH mode using Google DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://8.8.8.8/dns-query",
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    expect(net.isIPv4(ipA.address)).toBe(true);
    expect(ipA.family).toBe(4);
    expect(ipB).toBeUndefined();
  });

  test("Must throw an exception in DoH mode using Google DNS for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://8.8.8.8/dns-query",
    });

    await expect(resolver.resolve("google.invalid")).rejects.toThrow(
      ResolverNoAddressError
    );
  });

  // DoH - Quad9

  test("Must resolve google.com to an IPv6 and IPv4 address in DoH mode using Quad9 DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://9.9.9.9/dns-query",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must resolve ipv6.google.com to an IPv6 address in DoH mode using Quad9 DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://9.9.9.9/dns-query",
    });

    const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(ipB).toBeUndefined();
  });

  test("Must resolve ipv4.google.com to an IPv4 address in DoH mode using Quad9 DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://9.9.9.9/dns-query",
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    expect(net.isIPv4(ipA.address)).toBe(true);
    expect(ipA.family).toBe(4);
    expect(ipB).toBeUndefined();
  });

  test("Must throw an exception in DoH mode using Quad9 DNS for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://9.9.9.9/dns-query",
    });

    await expect(resolver.resolve("google.invalid")).rejects.toThrow(
      ResolverNoAddressError
    );
  });

  // DoH - AdGuard

  test("Must resolve google.com to an IPv6 and IPv4 address in DoH mode using AdGuard DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://dns.adguard.com/dns-query",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must resolve ipv6.google.com to an IPv6 address in DoH mode using AdGuard DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://dns.adguard.com/dns-query",
    });

    const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(ipB).toBeUndefined();
  });

  test("Must resolve ipv4.google.com to an IPv4 address in DoH mode using AdGuard DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://dns.adguard.com/dns-query",
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    expect(net.isIPv4(ipA.address)).toBe(true);
    expect(ipA.family).toBe(4);
    expect(ipB).toBeUndefined();
  });

  test("Must throw an exception in DoH mode using AdGuard DNS for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://dns.adguard.com/dns-query",
    });

    await expect(resolver.resolve("google.invalid")).rejects.toThrow(
      ResolverNoAddressError
    );
  });

  // DoT - Cloudflare

  test("Must resolve google.com to an IPv6 and IPv4 address in DoT mode using Cloudflare DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "1.0.0.1",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must resolve ipv6.google.com to an IPv6 address in DoT mode using Cloudflare DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "1.0.0.1",
    });

    const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(ipB).toBeUndefined();
  });

  test("Must resolve ipv4.google.com to an IPv4 address in DoT mode using Cloudflare DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "1.0.0.1",
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    expect(net.isIPv4(ipA.address)).toBe(true);
    expect(ipA.family).toBe(4);
    expect(ipB).toBeUndefined();
  });

  test("Must resolve google.com to an IPv6 and IPv4 address in DoT mode using Cloudflare DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "1.0.0.1",
      dotTlsServername: "cloudflare-dns.com",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must resolve google.com to an IPv6 and IPv4 address in DoT mode using Cloudflare DNS with a valid pinned certificate", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "1.0.0.1",
      dotTlsPin: "GP8Knf7qBae+aIfythytMbYnL+yowaWVeD6MoLHkVRg=",
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
      dotServer: "1.0.0.1",
      dotTlsServername: "cloudflare-dns.com",
      dotTlsPin: "GP8Knf7qBae+aIfythytMbYnL+yowaWVeD6MoLHkVRg=",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must throw an exception in DoT mode using Cloudflare DNS for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "1.0.0.1",
    });

    await expect(resolver.resolve("google.invalid")).rejects.toThrow(
      ResolverNoAddressError
    );
  });

  test("Must throw an exception in DoT mode using Cloudflare DNS with an invalid server name for a request to a valid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "1.0.0.1",
      dotTlsServername: "cloudflare-dns.invalid",
    });

    await expect(resolver.resolve("google.com")).rejects.toMatchObject({
      code: "ERR_TLS_CERT_ALTNAME_INVALID",
      host: "cloudflare-dns.invalid",
    });
  });

  test("Must throw an exception in DoT mode using Cloudflare DNS with an invalid pinned certificate for a request to a valid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "1.0.0.1",
      dotTlsPin: "aHVudGVyMg==",
    });

    await expect(resolver.resolve("google.com")).rejects.toThrow(
      ResolverCertificatePINError
    );
  });

  test("Must throw an exception in DoT mode using Cloudflare DNS with a valid server name and an invalid pinned certificate for a request to a valid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "1.0.0.1",
      dotTlsServername: "cloudflare-dns.com",
      dotTlsPin: "aHVudGVyMg==",
    });

    await expect(resolver.resolve("google.com")).rejects.toThrow(
      ResolverCertificatePINError
    );
  });

  test("Must throw an exception in DoT mode using Cloudflare DNS with an invalid server name and a valid pinned certificate for a request to a valid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "1.0.0.1",
      dotTlsServername: "cloudflare-dns.invalid",
      dotTlsPin: "GP8Knf7qBae+aIfythytMbYnL+yowaWVeD6MoLHkVRg=",
    });

    await expect(resolver.resolve("google.com")).rejects.toMatchObject({
      code: "ERR_TLS_CERT_ALTNAME_INVALID",
      host: "cloudflare-dns.invalid",
    });
  });

  test("Must throw an exception in DoT mode using Cloudflare DNS with an invalid server name and an invalid pinned certificate for a request to a valid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "1.0.0.1",
      dotTlsServername: "cloudflare-dns.invalid",
      dotTlsPin: "aHVudGVyMg==",
    });

    await expect(resolver.resolve("google.com")).rejects.toMatchObject({
      code: "ERR_TLS_CERT_ALTNAME_INVALID",
      host: "cloudflare-dns.invalid",
    });
  });

  // DoT - Google

  test("Must resolve google.com to an IPv6 and IPv4 address in DoT mode using Google DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "8.8.8.8",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must resolve ipv6.google.com to an IPv6 address in DoT mode using Google DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "8.8.8.8",
    });

    const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(ipB).toBeUndefined();
  });

  test("Must resolve ipv4.google.com to an IPv4 address in DoT mode using Google DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "8.8.8.8",
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    expect(net.isIPv4(ipA.address)).toBe(true);
    expect(ipA.family).toBe(4);
    expect(ipB).toBeUndefined();
  });

  test("Must throw an exception in DoT mode using Google DNS for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "8.8.8.8",
    });

    await expect(resolver.resolve("google.invalid")).rejects.toThrow(
      ResolverNoAddressError
    );
  });

  // DoT - Quad9

  test("Must resolve google.com to an IPv6 and IPv4 address in DoT mode using Quad9 DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "9.9.9.9",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must resolve ipv6.google.com to an IPv6 address in DoT mode using Quad9 DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "9.9.9.9",
    });

    const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(ipB).toBeUndefined();
  });

  test("Must resolve ipv4.google.com to an IPv4 address in DoT mode using Quad9 DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "9.9.9.9",
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    expect(net.isIPv4(ipA.address)).toBe(true);
    expect(ipA.family).toBe(4);
    expect(ipB).toBeUndefined();
  });

  test("Must throw an exception in DoT mode using Quad9 DNS for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "9.9.9.9",
    });

    await expect(resolver.resolve("google.invalid")).rejects.toThrow(
      ResolverNoAddressError
    );
  });

  // DoT - AdGuard

  test("Must resolve google.com to an IPv6 and IPv4 address in DoT mode using AdGuard DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "dns.adguard.com",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(net.isIPv4(ipB.address)).toBe(true);
    expect(ipB.family).toBe(4);
  });

  test("Must resolve ipv6.google.com to an IPv6 address in DoT mode using AdGuard DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "dns.adguard.com",
    });

    const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
    expect(net.isIPv6(ipA.address)).toBe(true);
    expect(ipA.family).toBe(6);
    expect(ipB).toBeUndefined();
  });

  test("Must resolve ipv4.google.com to an IPv4 address in DoT mode using AdGuard DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "dns.adguard.com",
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    expect(net.isIPv4(ipA.address)).toBe(true);
    expect(ipA.family).toBe(4);
    expect(ipB).toBeUndefined();
  });

  test("Must throw an exception in DoT mode using AdGuard DNS for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "dns.adguard.com",
    });

    await expect(resolver.resolve("google.invalid")).rejects.toThrow(
      ResolverNoAddressError
    );
  });
});
