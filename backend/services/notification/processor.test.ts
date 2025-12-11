import { describe, expect, it } from "vitest";

import { isChannelAllowed, priorityWeight } from "./processor";

describe("priorityWeight", () => {
  it("orders priorities from low to urgent", () => {
    expect(priorityWeight("low")).toBeLessThan(priorityWeight("normal"));
    expect(priorityWeight("urgent")).toBeGreaterThan(priorityWeight("high"));
  });
});

describe("isChannelAllowed", () => {
  it("allows channel when no preferences are set", () => {
    const allowed = isChannelAllowed("admin-dashboard", "normal", {
      channelPreferences: {},
      priorityThreshold: "normal",
    });
    expect(allowed).toBe(true);
  });

  it("blocks channel when muted until future", () => {
    const mutedUntil = new Date(Date.now() + 60_000).toISOString();
    const allowed = isChannelAllowed("admin-dashboard", "urgent", {
      channelPreferences: {},
      priorityThreshold: "low",
      mutedUntil,
    });
    expect(allowed).toBe(false);
  });

  it("respects channel-specific threshold", () => {
    const allowed = isChannelAllowed("email", "normal", {
      channelPreferences: {
        email: { enabled: true, minPriority: "high" },
      },
      priorityThreshold: "low",
    });
    expect(allowed).toBe(false);
  });
});
