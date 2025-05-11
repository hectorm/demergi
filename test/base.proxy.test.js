/* global runtime, describe, it, itIf, assert */

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
} from "./certs.js";

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
          path: runtime === "bun" ? `/${origin}` : origin,
          ...options,
        })
        .on(runtime === "bun" ? "response" : "connect", (_, socket) => {
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
          path: `${protocol}//${origin}${path}`,
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
  it("Must have specific defaults", () => {
    const proxy = new DemergiProxy();

    assert(!proxy.happyEyeballs);
    assert(proxy.resolver instanceof DemergiResolver);
  });

  it("Must start and stop", async () => {
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

    try {
      await proxy.start();

      assert(proxy.servers.size === 6);
      for (const server of proxy.servers) {
        assert(server.listening);
      }
    } finally {
      await proxy.stop();
    }

    assert(proxy.servers.size === 0);
  });

  it("Must establish an HTTPS connection to a valid domain through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    try {
      await proxy.start();

      const res = await httpProxyRequest({
        proxy,
        protocol: "https:",
        host: "cloudflare-dns.com",
      });

      assert(res.statusCode >= 200 && res.statusCode < 400);
    } finally {
      await proxy.stop();
    }
  });

  it("Must establish an HTTPS connection to a valid domain and port through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    try {
      await proxy.start();

      const res = await httpProxyRequest({
        proxy,
        protocol: "https:",
        host: "cloudflare-dns.com",
        port: 443,
      });

      assert(res.statusCode >= 200 && res.statusCode < 400);
    } finally {
      await proxy.stop();
    }
  });

  it("Must establish an HTTPS connection to a valid IP address through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    try {
      await proxy.start();

      const res = await httpProxyRequest({
        proxy,
        protocol: "https:",
        host: "1.0.0.1",
      });

      assert(res.statusCode >= 200 && res.statusCode < 400);
    } finally {
      await proxy.stop();
    }
  });

  it("Must establish an HTTPS connection to a valid IP address and port through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    try {
      await proxy.start();

      const res = await httpProxyRequest({
        proxy,
        protocol: "https:",
        host: "1.0.0.1",
        port: 443,
      });

      assert(res.statusCode >= 200 && res.statusCode < 400);
    } finally {
      await proxy.stop();
    }
  });

  it("Must throw an exception for an HTTPS request to an invalid domain through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    try {
      await proxy.start();

      await assert.rejects(
        httpProxyRequest({
          proxy,
          protocol: "https:",
          host: "example.invalid",
        }),
        (error) => {
          assert(error instanceof Error);
          if (runtime === "node") {
            assert.match(error.code, /^ECONNRESET$/);
          }
          return true;
        },
      );
    } finally {
      await proxy.stop();
    }
  });

  it("Must throw an exception for an HTTPS request to an invalid domain and port through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    try {
      await proxy.start();

      await assert.rejects(
        httpProxyRequest({
          proxy,
          protocol: "https:",
          host: "example.invalid",
          port: 443,
        }),
        (error) => {
          assert(error instanceof Error);
          if (runtime === "node") {
            assert.match(error.code, /^ECONNRESET$/);
          }
          return true;
        },
      );
    } finally {
      await proxy.stop();
    }
  });

  it("Must throw an exception for an HTTPS request to an invalid IP address through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    try {
      await proxy.start();

      await assert.rejects(
        httpProxyRequest({
          proxy,
          protocol: "https:",
          host: "300.300.300.300",
        }),
        (error) => {
          assert(error instanceof Error);
          if (runtime === "node") {
            assert.match(error.code, /^ECONNRESET$/);
          }
          return true;
        },
      );
    } finally {
      await proxy.stop();
    }
  });

  it("Must throw an exception for an HTTPS request to an invalid IP address and port through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    try {
      await proxy.start();

      await assert.rejects(
        httpProxyRequest({
          proxy,
          protocol: "https:",
          host: "300.300.300.300",
          port: 443,
        }),
        (error) => {
          assert(error instanceof Error);
          if (runtime === "node") {
            assert.match(error.code, /^ECONNRESET$/);
          }
          return true;
        },
      );
    } finally {
      await proxy.stop();
    }
  });

  it("Must establish an HTTP connection to a valid domain through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    try {
      await proxy.start();

      const res = await httpProxyRequest({
        proxy,
        protocol: "http:",
        host: "cloudflare-dns.com",
      });

      assert(res.statusCode >= 200 && res.statusCode < 400);
    } finally {
      await proxy.stop();
    }
  });

  it("Must establish an HTTP connection to a valid domain and port through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    try {
      await proxy.start();

      const res = await httpProxyRequest({
        proxy,
        protocol: "http:",
        host: "cloudflare-dns.com",
        port: 80,
      });

      assert(res.statusCode >= 200 && res.statusCode < 400);
    } finally {
      await proxy.stop();
    }
  });

  it("Must establish an HTTP connection to a valid IP address through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    try {
      await proxy.start();

      const res = await httpProxyRequest({
        proxy,
        protocol: "http:",
        host: "1.0.0.1",
      });

      assert(res.statusCode >= 200 && res.statusCode < 400);
    } finally {
      await proxy.stop();
    }
  });

  it("Must establish an HTTP connection to a valid IP address and port through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    try {
      await proxy.start();

      const res = await httpProxyRequest({
        proxy,
        protocol: "http:",
        host: "1.0.0.1",
        port: 80,
      });

      assert(res.statusCode >= 200 && res.statusCode < 400);
    } finally {
      await proxy.stop();
    }
  });

  itIf(runtime !== "bun")(
    "Must throw an exception for an HTTP request to an invalid domain through an HTTP proxy",
    async () => {
      const proxy = new DemergiProxy({
        addrs: ["localhost:0"],
      });

      try {
        await proxy.start();

        await assert.rejects(
          httpProxyRequest({
            proxy,
            protocol: "http:",
            host: "example.invalid",
          }),
          (error) => {
            assert(error instanceof Error);
            if (runtime === "node") {
              assert.match(error.code, /^ECONNRESET$/);
            }
            return true;
          },
        );
      } finally {
        await proxy.stop();
      }
    },
  );

  itIf(runtime !== "bun")(
    "Must throw an exception for an HTTP request to an invalid domain and port through an HTTP proxy",
    async () => {
      const proxy = new DemergiProxy({
        addrs: ["localhost:0"],
      });

      try {
        await proxy.start();

        await assert.rejects(
          httpProxyRequest({
            proxy,
            protocol: "http:",
            host: "example.invalid",
            port: 80,
          }),
          (error) => {
            assert(error instanceof Error);
            if (runtime === "node") {
              assert.match(error.code, /^ECONNRESET$/);
            }
            return true;
          },
        );
      } finally {
        await proxy.stop();
      }
    },
  );

  it("Must throw an exception for an HTTP request to an invalid IP address through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    try {
      await proxy.start();

      await assert.rejects(
        httpProxyRequest({
          proxy,
          protocol: "http:",
          host: "300.300.300.300",
        }),
        (error) => {
          assert(error instanceof Error);
          if (runtime === "node") {
            assert.match(error.code, /^ECONNRESET$/);
          }
          return true;
        },
      );
    } finally {
      await proxy.stop();
    }
  });

  it("Must throw an exception for an HTTP request to an invalid IP address and port through an HTTP proxy", async () => {
    const proxy = new DemergiProxy({
      addrs: ["localhost:0"],
    });

    try {
      await proxy.start();

      await assert.rejects(
        httpProxyRequest({
          proxy,
          protocol: "http:",
          host: "300.300.300.300",
          port: 80,
        }),
        (error) => {
          assert(error instanceof Error);
          if (runtime === "node") {
            assert.match(error.code, /^ECONNRESET$/);
          }
          return true;
        },
      );
    } finally {
      await proxy.stop();
    }
  });

  itIf(runtime !== "bun")(
    "Must establish an HTTPS connection through an HTTPS proxy",
    async () => {
      const proxy = new DemergiProxy({
        addrs: ["https://localhost:0"],
        tlsKey: TEST_TLS_SERVER_KEY,
        tlsCert: TEST_TLS_SERVER_CERT,
      });

      try {
        await proxy.start();

        const res = await httpProxyRequest({
          proxy,
          protocol: "https:",
          host: "cloudflare-dns.com",
          options: {
            ca: TEST_TLS_CA_CERT,
          },
        });

        assert(res.statusCode >= 200 && res.statusCode < 400);
      } finally {
        await proxy.stop();
      }
    },
  );

  itIf(runtime !== "bun")(
    "Must establish an HTTPS connection through an HTTPS proxy with mTLS",
    async () => {
      const proxy = new DemergiProxy({
        addrs: ["https://localhost:0"],
        tlsCa: TEST_TLS_CA_CERT,
        tlsKey: TEST_TLS_SERVER_KEY,
        tlsCert: TEST_TLS_SERVER_CERT,
      });

      try {
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

        assert(res.statusCode >= 200 && res.statusCode < 400);
      } finally {
        await proxy.stop();
      }
    },
  );

  itIf(runtime !== "bun")(
    "Must establish an HTTP connection through an HTTPS proxy",
    async () => {
      const proxy = new DemergiProxy({
        addrs: ["https://localhost:0"],
        tlsKey: TEST_TLS_SERVER_KEY,
        tlsCert: TEST_TLS_SERVER_CERT,
      });

      try {
        await proxy.start();

        const res = await httpProxyRequest({
          proxy,
          protocol: "http:",
          host: "cloudflare-dns.com",
          options: {
            ca: TEST_TLS_CA_CERT,
          },
        });

        assert(res.statusCode >= 200 && res.statusCode < 400);
      } finally {
        await proxy.stop();
      }
    },
  );

  itIf(runtime !== "bun")(
    "Must establish an HTTP connection through an HTTPS proxy with mTLS",
    async () => {
      const proxy = new DemergiProxy({
        addrs: ["https://localhost:0"],
        tlsCa: TEST_TLS_CA_CERT,
        tlsKey: TEST_TLS_SERVER_KEY,
        tlsCert: TEST_TLS_SERVER_CERT,
      });

      try {
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

        assert(res.statusCode >= 200 && res.statusCode < 400);
      } finally {
        await proxy.stop();
      }
    },
  );

  it("Must throw an exception when starting an HTTPS proxy with a malformed server key", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsKey: TEST_TLS_MALFORMED_KEY,
      tlsCert: TEST_TLS_SERVER_CERT,
    });

    try {
      await assert.rejects(proxy.start(), (error) => {
        assert(error instanceof Error);
        if (runtime === "node") {
          assert.match(error.code, /^ERR_OSSL_UNSUPPORTED$/);
        }
        return true;
      });
    } finally {
      await proxy.stop();
    }
  });

  it("Must throw an exception when starting an HTTPS proxy with a malformed server certificate", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsKey: TEST_TLS_SERVER_KEY,
      tlsCert: TEST_TLS_MALFORMED_CERT,
    });

    try {
      await assert.rejects(proxy.start(), (error) => {
        assert(error instanceof Error);
        if (runtime === "node") {
          assert.match(error.code, /^ERR_OSSL_ASN1_WRONG_TAG$/);
        }
        return true;
      });
    } finally {
      await proxy.stop();
    }
  });

  it("Must throw an exception for an HTTPS request through an HTTPS proxy with a malformed CA certificate bundle", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsCa: TEST_TLS_MALFORMED_CERT,
      tlsKey: TEST_TLS_SERVER_KEY,
      tlsCert: TEST_TLS_SERVER_CERT,
    });

    try {
      if (runtime === "bun") {
        await assert.rejects(proxy.start(), (error) => {
          assert(error instanceof Error);
          return true;
        });
      } else {
        await proxy.start();

        await assert.rejects(
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
          (error) => {
            assert(error instanceof Error);
            if (runtime === "node") {
              assert.match(error.code, /^ECONNRESET$/);
            }
            return true;
          },
        );
      }
    } finally {
      await proxy.stop();
    }
  });

  it("Must throw an exception for an HTTPS request through an HTTPS proxy without a server certificate", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
    });

    try {
      await proxy.start();

      await assert.rejects(
        httpProxyRequest({
          proxy,
          protocol: "https:",
          host: "cloudflare-dns.com",
          options: {
            ca: TEST_TLS_CA_CERT,
          },
        }),
        (error) => {
          assert(error instanceof Error);
          if (runtime === "node") {
            assert.match(error.code, /^EPROTO$/);
          }
          return true;
        },
      );
    } finally {
      await proxy.stop();
    }
  });

  it("Must throw an exception for an HTTPS request through an HTTPS proxy with an expired server certificate", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsKey: TEST_TLS_SERVER_KEY,
      tlsCert: TEST_TLS_SERVER_EXPIRED_CERT,
    });

    try {
      await proxy.start();

      await assert.rejects(
        httpProxyRequest({
          proxy,
          protocol: "https:",
          host: "cloudflare-dns.com",
          options: {
            ca: TEST_TLS_CA_CERT,
          },
        }),
        (error) => {
          assert(error instanceof Error);
          if (runtime === "node") {
            assert.match(error.code, /^CERT_HAS_EXPIRED$/);
          }
          return true;
        },
      );
    } finally {
      await proxy.stop();
    }
  });

  it("Must throw an exception for an HTTPS request through an HTTPS proxy with an untrusted server certificate", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsKey: TEST_TLS_SERVER_KEY,
      tlsCert: TEST_TLS_SERVER_CERT,
    });

    try {
      await proxy.start();

      await assert.rejects(
        httpProxyRequest({
          proxy,
          protocol: "https:",
          host: "cloudflare-dns.com",
        }),
        (error) => {
          assert(error instanceof Error);
          if (runtime === "node") {
            assert.match(error.code, /^UNABLE_TO_VERIFY_LEAF_SIGNATURE$/);
          }
          return true;
        },
      );
    } finally {
      await proxy.stop();
    }
  });

  it("Must throw an exception for an HTTPS request through an HTTPS proxy without a client certificate", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsCa: TEST_TLS_CA_CERT,
      tlsKey: TEST_TLS_SERVER_KEY,
      tlsCert: TEST_TLS_SERVER_CERT,
    });

    try {
      await proxy.start();

      await assert.rejects(
        httpProxyRequest({
          proxy,
          protocol: "https:",
          host: "cloudflare-dns.com",
          options: {
            ca: TEST_TLS_CA_CERT,
          },
        }),
        (error) => {
          assert(error instanceof Error);
          if (runtime === "node") {
            assert.match(
              error.code,
              /^ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED$/,
            );
          }
          return true;
        },
      );
    } finally {
      await proxy.stop();
    }
  });

  it("Must throw an exception for an HTTPS request through an HTTPS proxy with an expired client certificate", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsCa: TEST_TLS_CA_CERT,
      tlsKey: TEST_TLS_SERVER_KEY,
      tlsCert: TEST_TLS_SERVER_CERT,
    });

    try {
      await proxy.start();

      await assert.rejects(
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
        (error) => {
          assert(error instanceof Error);
          if (runtime === "node") {
            assert.match(error.code, /^ECONNRESET$/);
          }
          return true;
        },
      );
    } finally {
      await proxy.stop();
    }
  });

  it("Must throw an exception for an HTTPS request through an HTTPS proxy with an untrusted client certificate", async () => {
    const proxy = new DemergiProxy({
      addrs: ["https://localhost:0"],
      tlsCa: TEST_TLS_CA_CERT,
      tlsKey: TEST_TLS_SERVER_KEY,
      tlsCert: TEST_TLS_SERVER_CERT,
    });

    try {
      await proxy.start();

      await assert.rejects(
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
        (error) => {
          assert(error instanceof Error);
          if (runtime === "node") {
            assert.match(error.code, /^ERR_OSSL_X509_KEY_VALUES_MISMATCH$/);
          }
          return true;
        },
      );
    } finally {
      await proxy.stop();
    }
  });
});
