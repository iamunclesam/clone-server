import { describe, it, expect } from "vitest";
import { INITIAL_INTEGRATION_CATALOG, IntegrationCatalogItem } from "../catalog";

describe("Integration Catalog & Capabilities", () => {
  it("should contain 18 production integration providers", () => {
    expect(INITIAL_INTEGRATION_CATALOG).toHaveLength(18);
  });

  it("should include GitHub provider with repo capabilities", () => {
    const gh = INITIAL_INTEGRATION_CATALOG.find((i: IntegrationCatalogItem) => i.id === "github");
    expect(gh).toBeDefined();
    expect(gh?.name).toBe("GitHub");
    expect(gh?.capabilitiesCount).toBe(5);
  });

  it("should categorize integrations into functional areas", () => {
    const categories = new Set(INITIAL_INTEGRATION_CATALOG.map((i: IntegrationCatalogItem) => i.category));
    expect(categories.has("Engineering")).toBe(true);
    expect(categories.has("Communication")).toBe(true);
    expect(categories.has("Project management")).toBe(true);
    expect(categories.has("CRM")).toBe(true);
  });
});
