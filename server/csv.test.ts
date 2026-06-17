import { describe, expect, it } from "vitest";
import { escapeCsvField, toCsv } from "../shared/csv";

describe("escapeCsvField", () => {
  it("leaves a plain value untouched", () => {
    expect(escapeCsvField("Acme")).toBe("Acme");
    expect(escapeCsvField(42)).toBe("42");
  });

  it("renders null/undefined as empty cells", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });

  it("quotes values containing a comma", () => {
    expect(escapeCsvField("Acme, Inc")).toBe('"Acme, Inc"');
  });

  it("quotes and doubles inner double quotes", () => {
    expect(escapeCsvField('the "big" co')).toBe('"the ""big"" co"');
  });

  it("quotes values with newlines", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("toCsv", () => {
  const cols = [
    { header: "ID", value: (r: { id: number; name: string }) => r.id },
    { header: "Name", value: (r: { id: number; name: string }) => r.name },
  ];

  it("emits a header line then one CRLF-separated row per item", () => {
    const csv = toCsv([{ id: 1, name: "Acme" }, { id: 2, name: "Globex" }], cols);
    expect(csv).toBe("ID,Name\r\n1,Acme\r\n2,Globex");
  });

  it("escapes fields that need quoting inside a row", () => {
    const csv = toCsv([{ id: 1, name: 'Acme, "Big" Co' }], cols);
    expect(csv).toBe('ID,Name\r\n1,"Acme, ""Big"" Co"');
  });

  it("emits just the header for an empty dataset", () => {
    expect(toCsv([], cols)).toBe("ID,Name");
  });
});
