/* global runtime, describe, it, itIf, assert */

import os from "node:os";
import net from "node:net";
import { DemergiResolver } from "../src/resolver.js";
import {
  ResolverCertificatePINError,
  ResolverNoAddressError,
} from "../src/errors.js";

describe("Resolver", () => {
  it("Must have specific defaults", () => {
    const defaults = new DemergiResolver();

    assert(defaults.dnsMode === "doh");
    assert(defaults.dnsCache.max === 100000);
    assert(defaults.dohUrl.toString() === "https://1.0.0.1/dns-query");
    assert(defaults.dohTlsServername === undefined);
    assert(defaults.dohTlsPin === undefined);
    assert(defaults.dotServer.toString() === "tls://1.0.0.1");
    assert(defaults.dotTlsServername === undefined);
    assert(defaults.dotTlsPin === undefined);
  });

  // Plain

  itIf(runtime !== "bun" || os.platform().match(/^linux$/))(
    "Must resolve google.com to an IPv6 and IPv4 address in plain DNS mode",
    async () => {
      const resolver = new DemergiResolver({
        dnsMode: "plain",
      });

      const [ipA, ipB] = await resolver.resolve("google.com");
      assert(net.isIPv6(ipA.address));
      assert(ipA.family === 6);
      assert(net.isIPv4(ipB.address));
      assert(ipB.family === 4);
    },
  );

  itIf(runtime !== "bun" || os.platform().match(/^linux$/))(
    "Must resolve ipv6.google.com to an IPv6 address in plain DNS mode",
    async () => {
      const resolver = new DemergiResolver({
        dnsMode: "plain",
      });

      const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
      assert(net.isIPv6(ipA.address));
      assert(ipA.family === 6);
      assert(ipB === undefined);
    },
  );

  it("Must resolve ipv4.google.com to an IPv4 address in plain DNS mode", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "plain",
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    assert(net.isIPv4(ipA.address));
    assert(ipA.family === 4);
    assert(ipB === undefined);
  });

  it("Must throw an exception in plain DNS mode for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "plain",
    });

    await assert.rejects(
      resolver.resolve("google.invalid"),
      ResolverNoAddressError,
    );
  });

  // DoH - Cloudflare

  it("Must resolve google.com to an IPv6 and IPv4 address in DoH mode using Cloudflare DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://1.0.0.1/dns-query",
      dohPersistent: false,
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    assert(net.isIPv6(ipA.address));
    assert(ipA.family === 6);
    assert(net.isIPv4(ipB.address));
    assert(ipB.family === 4);
  });

  it("Must resolve ipv6.google.com to an IPv6 address in DoH mode using Cloudflare DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://1.0.0.1/dns-query",
      dohPersistent: false,
    });

    const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
    assert(net.isIPv6(ipA.address));
    assert(ipA.family === 6);
    assert(ipB === undefined);
  });

  it("Must resolve ipv4.google.com to an IPv4 address in DoH mode using Cloudflare DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://1.0.0.1/dns-query",
      dohPersistent: false,
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    assert(net.isIPv4(ipA.address));
    assert(ipA.family === 4);
    assert(ipB === undefined);
  });

  it("Must resolve google.com to an IPv6 and IPv4 address in DoH mode using Cloudflare DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://1.0.0.1/dns-query",
      dohTlsServername: "cloudflare-dns.com",
      dohPersistent: false,
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    assert(net.isIPv6(ipA.address));
    assert(ipA.family === 6);
    assert(net.isIPv4(ipB.address));
    assert(ipB.family === 4);
  });

  itIf(runtime !== "bun")(
    "Must resolve google.com to an IPv6 and IPv4 address in DoH mode using Cloudflare DNS with a valid pinned certificate",
    async () => {
      const resolver = new DemergiResolver({
        dnsMode: "doh",
        dohUrl: "https://1.0.0.1/dns-query",
        dohTlsPin: "4pqQ+yl3lAtRvKdoCCUR8iDmA53I+cJ7orgBLiF08kQ=",
        dohPersistent: false,
      });

      const [ipA, ipB] = await resolver.resolve("google.com");
      assert(net.isIPv6(ipA.address));
      assert(ipA.family === 6);
      assert(net.isIPv4(ipB.address));
      assert(ipB.family === 4);
    },
  );

  itIf(runtime !== "bun")(
    "Must resolve google.com to an IPv6 and IPv4 address in DoH mode using Cloudflare DNS with a valid server name and a valid pinned certificate",
    async () => {
      const resolver = new DemergiResolver({
        dnsMode: "doh",
        dohUrl: "https://1.0.0.1/dns-query",
        dohTlsServername: "cloudflare-dns.com",
        dohTlsPin: "4pqQ+yl3lAtRvKdoCCUR8iDmA53I+cJ7orgBLiF08kQ=",
        dohPersistent: false,
      });

      const [ipA, ipB] = await resolver.resolve("google.com");
      assert(net.isIPv6(ipA.address));
      assert(ipA.family === 6);
      assert(net.isIPv4(ipB.address));
      assert(ipB.family === 4);
    },
  );

  it("Must throw an exception in DoH mode using Cloudflare DNS for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://1.0.0.1/dns-query",
      dohPersistent: false,
    });

    await assert.rejects(
      resolver.resolve("google.invalid"),
      ResolverNoAddressError,
    );
  });

  it("Must throw an exception in DoH mode using Cloudflare DNS with an invalid server name for a request to a valid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://1.0.0.1/dns-query",
      dohTlsServername: "cloudflare-dns.invalid",
      dohPersistent: false,
    });

    await assert.rejects(resolver.resolve("google.com"), (error) => {
      assert(error instanceof Error);
      if (runtime === "node") {
        assert.match(error.code, /^ERR_TLS_CERT_ALTNAME_INVALID$/);
        assert.strictEqual(error.host, "cloudflare-dns.invalid");
      }
      return true;
    });
  });

  itIf(runtime !== "bun")(
    "Must throw an exception in DoH mode using Cloudflare DNS with an invalid pinned certificate for a request to a valid domain",
    async () => {
      const resolver = new DemergiResolver({
        dnsMode: "doh",
        dohUrl: "https://1.0.0.1/dns-query",
        dohTlsPin: "aHVudGVyMg==",
        dohPersistent: false,
      });

      await assert.rejects(
        resolver.resolve("google.com"),
        ResolverCertificatePINError,
      );
    },
  );

  itIf(runtime !== "bun")(
    "Must throw an exception in DoH mode using Cloudflare DNS with a valid server name and an invalid pinned certificate for a request to a valid domain",
    async () => {
      const resolver = new DemergiResolver({
        dnsMode: "doh",
        dohUrl: "https://1.0.0.1/dns-query",
        dohTlsServername: "cloudflare-dns.com",
        dohTlsPin: "aHVudGVyMg==",
        dohPersistent: false,
      });

      await assert.rejects(
        resolver.resolve("google.com"),
        ResolverCertificatePINError,
      );
    },
  );

  itIf(runtime !== "bun")(
    "Must throw an exception in DoH mode using Cloudflare DNS with an invalid server name and a valid pinned certificate for a request to a valid domain",
    async () => {
      const resolver = new DemergiResolver({
        dnsMode: "doh",
        dohUrl: "https://1.0.0.1/dns-query",
        dohTlsServername: "cloudflare-dns.invalid",
        dohTlsPin: "4pqQ+yl3lAtRvKdoCCUR8iDmA53I+cJ7orgBLiF08kQ=",
        dohPersistent: false,
      });

      await assert.rejects(resolver.resolve("google.com"), (error) => {
        assert(error instanceof Error);
        if (runtime === "node") {
          assert.match(error.code, /^ERR_TLS_CERT_ALTNAME_INVALID$/);
          assert.strictEqual(error.host, "cloudflare-dns.invalid");
        }
        return true;
      });
    },
  );

  itIf(runtime !== "bun")(
    "Must throw an exception in DoH mode using Cloudflare DNS with an invalid server name and an invalid pinned certificate for a request to a valid domain",
    async () => {
      const resolver = new DemergiResolver({
        dnsMode: "doh",
        dohUrl: "https://1.0.0.1/dns-query",
        dohTlsServername: "cloudflare-dns.invalid",
        dohTlsPin: "aHVudGVyMg==",
        dohPersistent: false,
      });

      await assert.rejects(resolver.resolve("google.com"), (error) => {
        assert(error instanceof Error);
        if (runtime === "node") {
          assert.match(error.code, /^ERR_TLS_CERT_ALTNAME_INVALID$/);
          assert.strictEqual(error.host, "cloudflare-dns.invalid");
        }
        return true;
      });
    },
  );

  // DoH - Google

  it("Must resolve google.com to an IPv6 and IPv4 address in DoH mode using Google DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://8.8.8.8/dns-query",
      dohPersistent: false,
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    assert(net.isIPv6(ipA.address));
    assert(ipA.family === 6);
    assert(net.isIPv4(ipB.address));
    assert(ipB.family === 4);
  });

  it("Must resolve ipv6.google.com to an IPv6 address in DoH mode using Google DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://8.8.8.8/dns-query",
      dohPersistent: false,
    });

    const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
    assert(net.isIPv6(ipA.address));
    assert(ipA.family === 6);
    assert(ipB === undefined);
  });

  it("Must resolve ipv4.google.com to an IPv4 address in DoH mode using Google DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://8.8.8.8/dns-query",
      dohPersistent: false,
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    assert(net.isIPv4(ipA.address));
    assert(ipA.family === 4);
    assert(ipB === undefined);
  });

  it("Must throw an exception in DoH mode using Google DNS for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://8.8.8.8/dns-query",
      dohPersistent: false,
    });

    await assert.rejects(
      resolver.resolve("google.invalid"),
      ResolverNoAddressError,
    );
  });

  // DoH - AdGuard

  it("Must resolve google.com to an IPv6 and IPv4 address in DoH mode using AdGuard DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://dns.adguard.com/dns-query",
      dohPersistent: false,
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    assert(net.isIPv6(ipA.address));
    assert(ipA.family === 6);
    assert(net.isIPv4(ipB.address));
    assert(ipB.family === 4);
  });

  it("Must resolve ipv6.google.com to an IPv6 address in DoH mode using AdGuard DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://dns.adguard.com/dns-query",
      dohPersistent: false,
    });

    const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
    assert(net.isIPv6(ipA.address));
    assert(ipA.family === 6);
    assert(ipB === undefined);
  });

  it("Must resolve ipv4.google.com to an IPv4 address in DoH mode using AdGuard DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://dns.adguard.com/dns-query",
      dohPersistent: false,
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    assert(net.isIPv4(ipA.address));
    assert(ipA.family === 4);
    assert(ipB === undefined);
  });

  it("Must throw an exception in DoH mode using AdGuard DNS for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "doh",
      dohUrl: "https://dns.adguard.com/dns-query",
      dohPersistent: false,
    });

    await assert.rejects(
      resolver.resolve("google.invalid"),
      ResolverNoAddressError,
    );
  });

  // DoT - Cloudflare

  it("Must resolve google.com to an IPv6 and IPv4 address in DoT mode using Cloudflare DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "1.0.0.1",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    assert(net.isIPv6(ipA.address));
    assert(ipA.family === 6);
    assert(net.isIPv4(ipB.address));
    assert(ipB.family === 4);
  });

  it("Must resolve ipv6.google.com to an IPv6 address in DoT mode using Cloudflare DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "1.0.0.1",
    });

    const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
    assert(net.isIPv6(ipA.address));
    assert(ipA.family === 6);
    assert(ipB === undefined);
  });

  it("Must resolve ipv4.google.com to an IPv4 address in DoT mode using Cloudflare DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "1.0.0.1",
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    assert(net.isIPv4(ipA.address));
    assert(ipA.family === 4);
    assert(ipB === undefined);
  });

  it("Must resolve google.com to an IPv6 and IPv4 address in DoT mode using Cloudflare DNS with a valid server name", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "1.0.0.1",
      dotTlsServername: "cloudflare-dns.com",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    assert(net.isIPv6(ipA.address));
    assert(ipA.family === 6);
    assert(net.isIPv4(ipB.address));
    assert(ipB.family === 4);
  });

  itIf(runtime !== "bun")(
    "Must resolve google.com to an IPv6 and IPv4 address in DoT mode using Cloudflare DNS with a valid pinned certificate",
    async () => {
      const resolver = new DemergiResolver({
        dnsMode: "dot",
        dotServer: "1.0.0.1",
        dotTlsPin: "4pqQ+yl3lAtRvKdoCCUR8iDmA53I+cJ7orgBLiF08kQ=",
      });

      const [ipA, ipB] = await resolver.resolve("google.com");
      assert(net.isIPv6(ipA.address));
      assert(ipA.family === 6);
      assert(net.isIPv4(ipB.address));
      assert(ipB.family === 4);
    },
  );

  itIf(runtime !== "bun")(
    "Must resolve google.com to an IPv6 and IPv4 address in DoT mode using Cloudflare DNS with a valid server name and a valid pinned certificate",
    async () => {
      const resolver = new DemergiResolver({
        dnsMode: "dot",
        dotServer: "1.0.0.1",
        dotTlsServername: "cloudflare-dns.com",
        dotTlsPin: "4pqQ+yl3lAtRvKdoCCUR8iDmA53I+cJ7orgBLiF08kQ=",
      });

      const [ipA, ipB] = await resolver.resolve("google.com");
      assert(net.isIPv6(ipA.address));
      assert(ipA.family === 6);
      assert(net.isIPv4(ipB.address));
      assert(ipB.family === 4);
    },
  );

  it("Must throw an exception in DoT mode using Cloudflare DNS for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "1.0.0.1",
    });

    await assert.rejects(
      resolver.resolve("google.invalid"),
      ResolverNoAddressError,
    );
  });

  it("Must throw an exception in DoT mode using Cloudflare DNS with an invalid server name for a request to a valid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "1.0.0.1",
      dotTlsServername: "cloudflare-dns.invalid",
    });

    await assert.rejects(resolver.resolve("google.com"), (error) => {
      assert(error instanceof Error);
      if (runtime === "node") {
        assert.match(error.code, /^ERR_TLS_CERT_ALTNAME_INVALID$/);
        assert.strictEqual(error.host, "cloudflare-dns.invalid");
      }
      return true;
    });
  });

  itIf(runtime !== "bun")(
    "Must throw an exception in DoT mode using Cloudflare DNS with an invalid pinned certificate for a request to a valid domain",
    async () => {
      const resolver = new DemergiResolver({
        dnsMode: "dot",
        dotServer: "1.0.0.1",
        dotTlsPin: "aHVudGVyMg==",
      });

      await assert.rejects(
        resolver.resolve("google.com"),
        ResolverCertificatePINError,
      );
    },
  );

  itIf(runtime !== "bun")(
    "Must throw an exception in DoT mode using Cloudflare DNS with a valid server name and an invalid pinned certificate for a request to a valid domain",
    async () => {
      const resolver = new DemergiResolver({
        dnsMode: "dot",
        dotServer: "1.0.0.1",
        dotTlsServername: "cloudflare-dns.com",
        dotTlsPin: "aHVudGVyMg==",
      });

      await assert.rejects(
        resolver.resolve("google.com"),
        ResolverCertificatePINError,
      );
    },
  );

  itIf(runtime !== "bun")(
    "Must throw an exception in DoT mode using Cloudflare DNS with an invalid server name and a valid pinned certificate for a request to a valid domain",
    async () => {
      const resolver = new DemergiResolver({
        dnsMode: "dot",
        dotServer: "1.0.0.1",
        dotTlsServername: "cloudflare-dns.invalid",
        dotTlsPin: "4pqQ+yl3lAtRvKdoCCUR8iDmA53I+cJ7orgBLiF08kQ=",
      });

      await assert.rejects(resolver.resolve("google.com"), (error) => {
        assert(error instanceof Error);
        if (runtime === "node") {
          assert.match(error.code, /^ERR_TLS_CERT_ALTNAME_INVALID$/);
          assert.strictEqual(error.host, "cloudflare-dns.invalid");
        }
        return true;
      });
    },
  );

  itIf(runtime !== "bun")(
    "Must throw an exception in DoT mode using Cloudflare DNS with an invalid server name and an invalid pinned certificate for a request to a valid domain",
    async () => {
      const resolver = new DemergiResolver({
        dnsMode: "dot",
        dotServer: "1.0.0.1",
        dotTlsServername: "cloudflare-dns.invalid",
        dotTlsPin: "aHVudGVyMg==",
      });

      await assert.rejects(resolver.resolve("google.com"), (error) => {
        assert(error instanceof Error);
        if (runtime === "node") {
          assert.match(error.code, /^ERR_TLS_CERT_ALTNAME_INVALID$/);
          assert.strictEqual(error.host, "cloudflare-dns.invalid");
        }
        return true;
      });
    },
  );

  // DoT - Google

  it("Must resolve google.com to an IPv6 and IPv4 address in DoT mode using Google DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "8.8.8.8",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    assert(net.isIPv6(ipA.address));
    assert(ipA.family === 6);
    assert(net.isIPv4(ipB.address));
    assert(ipB.family === 4);
  });

  it("Must resolve ipv6.google.com to an IPv6 address in DoT mode using Google DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "8.8.8.8",
    });

    const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
    assert(net.isIPv6(ipA.address));
    assert(ipA.family === 6);
    assert(ipB === undefined);
  });

  it("Must resolve ipv4.google.com to an IPv4 address in DoT mode using Google DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "8.8.8.8",
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    assert(net.isIPv4(ipA.address));
    assert(ipA.family === 4);
    assert(ipB === undefined);
  });

  it("Must throw an exception in DoT mode using Google DNS for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "8.8.8.8",
    });

    await assert.rejects(
      resolver.resolve("google.invalid"),
      ResolverNoAddressError,
    );
  });

  // DoT - AdGuard

  it("Must resolve google.com to an IPv6 and IPv4 address in DoT mode using AdGuard DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "dns.adguard.com",
    });

    const [ipA, ipB] = await resolver.resolve("google.com");
    assert(net.isIPv6(ipA.address));
    assert(ipA.family === 6);
    assert(net.isIPv4(ipB.address));
    assert(ipB.family === 4);
  });

  it("Must resolve ipv6.google.com to an IPv6 address in DoT mode using AdGuard DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "dns.adguard.com",
    });

    const [ipA, ipB] = await resolver.resolve("ipv6.google.com");
    assert(net.isIPv6(ipA.address));
    assert(ipA.family === 6);
    assert(ipB === undefined);
  });

  it("Must resolve ipv4.google.com to an IPv4 address in DoT mode using AdGuard DNS", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "dns.adguard.com",
    });

    const [ipA, ipB] = await resolver.resolve("ipv4.google.com");
    assert(net.isIPv4(ipA.address));
    assert(ipA.family === 4);
    assert(ipB === undefined);
  });

  it("Must throw an exception in DoT mode using AdGuard DNS for a request to an invalid domain", async () => {
    const resolver = new DemergiResolver({
      dnsMode: "dot",
      dotServer: "dns.adguard.com",
    });

    await assert.rejects(
      resolver.resolve("google.invalid"),
      ResolverNoAddressError,
    );
  });
});
