// Tests for the fetch wrapper itself (api.js's `request` function and the
// token helpers) — the part every page depends on for auth headers, error
// messages, and session-expiry handling. Mocks global fetch rather than
// hitting a real backend, so these run without the FastAPI server up.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, clearToken, getToken, setToken } from "./api";

function mockFetchOnce({ ok = true, status = 200, body = {} } = {}) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  });
  return globalThis.fetch;
}

describe("token helpers", () => {
  afterEach(() => localStorage.clear());

  it("setToken/getToken/clearToken round-trip through localStorage", () => {
    expect(getToken()).toBeNull();
    setToken("abc123");
    expect(getToken()).toBe("abc123");
    clearToken();
    expect(getToken()).toBeNull();
  });
});

describe("request()", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("does not attach an Authorization header for non-auth calls, even with a token stored", async () => {
    setToken("some-token");
    const fetchSpy = mockFetchOnce({ body: [] });

    await api.getStats();

    const [, options] = fetchSpy.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it("attaches the stored token as a Bearer header for auth calls", async () => {
    setToken("some-token");
    const fetchSpy = mockFetchOnce({ body: { access_token: "x", user: {} } });

    await api.me();

    const [, options] = fetchSpy.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer some-token");
  });

  it("omits the Authorization header for auth calls when there is no stored token", async () => {
    const fetchSpy = mockFetchOnce({ body: [] });

    // runCustomSimulation is auth:true but allowed anonymously (see
    // api.js) — it just shouldn't crash or send a bogus header when
    // logged out.
    await api.runCustomSimulation({});

    const [, options] = fetchSpy.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it("on a 401 for an auth call: clears the token and throws 'Session expired'", async () => {
    setToken("stale-token");
    mockFetchOnce({ ok: false, status: 401 });

    // jsdom's window.location.assign isn't spy-able in place (its property
    // descriptor isn't configurable), so the whole location object is
    // swapped out for a plain stub for the duration of this test.
    const originalLocation = window.location;
    const assignMock = vi.fn();
    delete window.location;
    window.location = { ...originalLocation, assign: assignMock };

    try {
      await expect(api.getHistory()).rejects.toThrow("Session expired");
      expect(getToken()).toBeNull();
      expect(assignMock).toHaveBeenCalledWith("/login");
    } finally {
      window.location = originalLocation;
    }
  });

  it("on a non-401 error response: throws the server's detail message", async () => {
    mockFetchOnce({ ok: false, status: 400, body: { detail: "Select at least 3 horses" } });

    await expect(api.runCustomSimulation({})).rejects.toThrow("Select at least 3 horses");
  });

  it("on an error response with no JSON body: throws a generic fallback message", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    });

    await expect(api.getStats()).rejects.toThrow("Something went wrong");
  });

  it("returns null for a 204 No Content response instead of trying to parse a body", async () => {
    mockFetchOnce({ ok: true, status: 204 });

    const result = await api.changePassword("old", "new");
    expect(result).toBeNull();
  });

  it("returns the parsed JSON body on success", async () => {
    mockFetchOnce({ body: { total: 1770 } });

    const result = await api.getStats();
    expect(result).toEqual({ total: 1770 });
  });

  it("on a network failure: throws a friendly message instead of the raw fetch error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(api.getStats()).rejects.toThrow("Couldn't reach the server");
  });

  it("URL-encodes search terms for the horse search endpoint", async () => {
    const fetchSpy = mockFetchOnce({ body: [] });

    await api.searchHorses("Ascot & Sons");

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toContain(encodeURIComponent("Ascot & Sons"));
  });

  it("populateHorses omits race_class when raceClass isn't given, and includes it when it is", async () => {
    const fetchSpy = mockFetchOnce({ body: [] });

    await api.populateHorses();
    let [url] = fetchSpy.mock.calls[0];
    expect(url).toContain("random=true");
    expect(url).not.toContain("race_class");

    await api.populateHorses({ raceClass: "Class 1" });
    [url] = fetchSpy.mock.calls[1];
    // URLSearchParams encodes a space as "+" (standard query-string form),
    // not "%20" — that's correct, not a bug, so the test matches it.
    expect(url).toContain("race_class=Class+1");
  });

  it("createCheckoutSession posts to /billing/checkout-session with an auth header", async () => {
    setToken("some-token");
    const fetchSpy = mockFetchOnce({ body: { checkout_url: "https://checkout.stripe.com/abc" } });

    const result = await api.createCheckoutSession();

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toContain("/billing/checkout-session");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer some-token");
    expect(result).toEqual({ checkout_url: "https://checkout.stripe.com/abc" });
  });

  it("createPortalSession posts to /billing/portal-session with an auth header", async () => {
    setToken("some-token");
    const fetchSpy = mockFetchOnce({ body: { portal_url: "https://billing.stripe.com/abc" } });

    const result = await api.createPortalSession();

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toContain("/billing/portal-session");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer some-token");
    expect(result).toEqual({ portal_url: "https://billing.stripe.com/abc" });
  });
});
