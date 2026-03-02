import { getDataPermissionsDescription } from "./TenantsSummaryOnboardingStep";

describe("getDataPermissionsDescription", () => {
  describe("row-column-level-security", () => {
    it("returns a sentence with one table", () => {
      expect(
        getDataPermissionsDescription({
          strategy: "row-column-level-security",
          tenantName: "Acme Corp",
          tenantValue: "42",
          tableNames: ["Orders"],
          columnName: "company_id",
        }),
      ).toBe(
        "All users in Acme Corp can view rows in the Orders tables where company_id field equals 42.",
      );
    });

    it("returns a sentence with multiple tables joined by 'and'", () => {
      expect(
        getDataPermissionsDescription({
          strategy: "row-column-level-security",
          tenantName: "Acme Corp",
          tenantValue: "42",
          tableNames: ["Orders", "Products"],
          columnName: "company_id",
        }),
      ).toBe(
        "All users in Acme Corp can view rows in the Orders and Products tables where company_id field equals 42.",
      );
    });

    it("returns a sentence with three tables", () => {
      expect(
        getDataPermissionsDescription({
          strategy: "row-column-level-security",
          tenantName: "Acme Corp",
          tenantValue: "42",
          tableNames: ["Orders", "Products", "Reviews"],
          columnName: "company_id",
        }),
      ).toBe(
        "All users in Acme Corp can view rows in the Orders, Products and Reviews tables where company_id field equals 42.",
      );
    });

    it("returns null when tableNames is empty", () => {
      expect(
        getDataPermissionsDescription({
          strategy: "row-column-level-security",
          tenantName: "Acme Corp",
          tenantValue: "42",
          tableNames: [],
          columnName: "company_id",
        }),
      ).toBeNull();
    });

    it("returns null when columnName is null", () => {
      expect(
        getDataPermissionsDescription({
          strategy: "row-column-level-security",
          tenantName: "Acme Corp",
          tenantValue: "42",
          tableNames: ["Orders"],
          columnName: null,
        }),
      ).toBeNull();
    });
  });

  describe("connection-impersonation", () => {
    it("returns a sentence with the database role", () => {
      expect(
        getDataPermissionsDescription({
          strategy: "connection-impersonation",
          tenantName: "Acme Corp",
          tenantValue: "acme_role",
          tableNames: [],
          columnName: null,
        }),
      ).toBe(
        "All users in Acme Corp will connect using the acme_role database role.",
      );
    });
  });

  describe("database-routing", () => {
    it("returns a sentence with the database slug", () => {
      expect(
        getDataPermissionsDescription({
          strategy: "database-routing",
          tenantName: "Acme Corp",
          tenantValue: "acme-db",
          tableNames: [],
          columnName: null,
        }),
      ).toBe("All users in Acme Corp will be routed to the acme-db database.");
    });
  });

  describe("edge cases", () => {
    it("returns null when tenantValue is empty", () => {
      expect(
        getDataPermissionsDescription({
          strategy: "connection-impersonation",
          tenantName: "Acme Corp",
          tenantValue: "",
          tableNames: [],
          columnName: null,
        }),
      ).toBeNull();
    });

    it("returns null for unknown strategy", () => {
      expect(
        getDataPermissionsDescription({
          strategy: null,
          tenantName: "Acme Corp",
          tenantValue: "42",
          tableNames: [],
          columnName: null,
        }),
      ).toBeNull();
    });
  });
});
