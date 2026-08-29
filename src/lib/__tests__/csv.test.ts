import { describe, it, expect } from "vitest";
import { parseCsv, buildCsv } from "../csv";

describe("csv", () => {
  it("parses a simple comma-separated file", () => {
    const rows = parseCsv("a,b,c\n1,2,3");
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields containing commas and newlines", () => {
    const rows = parseCsv('name,note\n"Smith, John","line1\nline2"');
    expect(rows).toEqual([
      ["name", "note"],
      ["Smith, John", "line1\nline2"],
    ]);
  });

  it("handles escaped double quotes inside a quoted field", () => {
    const rows = parseCsv('field\n"she said ""hi"""');
    expect(rows).toEqual([["field"], ['she said "hi"']]);
  });

  it("round-trips build → parse for values needing quoting", () => {
    const original = [
      ["site_name", "site_url", "username", "password"],
      ["Contains, Comma", "example.com", 'quote"here', "plain"],
    ];

    const csv = buildCsv(original);
    const parsed = parseCsv(csv);

    expect(parsed).toEqual(original);
  });
});
