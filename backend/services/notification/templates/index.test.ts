import { describe, expect, it } from "vitest";

import { notificationTemplates, renderTemplate } from "./index";

describe("notification templates", () => {
  it("does not ship with built-in templates", () => {
    expect(Object.keys(notificationTemplates)).toHaveLength(0);
  });

  it("falls back to provided subject/body when template is missing", () => {
    const { subject, body } = renderTemplate("non-existent", {
      subject: "Fallback subject",
      body: "Fallback body",
    });

    expect(subject).toBe("Fallback subject");
    expect(body).toBe("Fallback body");
  });
});
