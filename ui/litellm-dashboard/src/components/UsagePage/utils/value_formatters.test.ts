import { describe, expect, it } from "vitest";
import { valueFormatter, valueFormatterSpend } from "./value_formatters";

describe("valueFormatter", () => {
  it("should format numbers >= 1,000,000 as millions with 2 decimal places", () => {
    expect(valueFormatter(1_000_000)).toBe("1.00M");
    expect(valueFormatter(1_500_000)).toBe("1.50M");
    expect(valueFormatter(2_750_000)).toBe("2.75M");
    expect(valueFormatter(10_000_000)).toBe("10.00M");
  });

  it("should format numbers in the thousands range as 'k' suffix", () => {
    expect(valueFormatter(1_000)).toBe("1k");
    expect(valueFormatter(5_500)).toBe("5.5k");
    expect(valueFormatter(999_999)).toBe("999.999k");
  });

  it("should return the plain string for numbers below 1,000", () => {
    expect(valueFormatter(0)).toBe("0");
    expect(valueFormatter(1)).toBe("1");
    expect(valueFormatter(999)).toBe("999");
    expect(valueFormatter(42)).toBe("42");
  });

  it("should treat exactly 1,000,000 as the millions boundary", () => {
    expect(valueFormatter(1_000_000)).toBe("1.00M");
  });

  it("should treat exactly 1,000 as the thousands boundary", () => {
    expect(valueFormatter(1_000)).toBe("1k");
  });
});

describe("valueFormatterSpend", () => {
  it("should return '0 tokens' when the value is exactly zero", () => {
    expect(valueFormatterSpend(0)).toBe("0 tokens");
  });

  it("should format numbers >= 1,000,000 as abbreviated token millions", () => {
    expect(valueFormatterSpend(1_000_000)).toBe("1M tokens");
    expect(valueFormatterSpend(2_500_000)).toBe("2.5M tokens");
    expect(valueFormatterSpend(10_000_000)).toBe("10M tokens");
  });

  it("should format numbers >= 1,000 as abbreviated token thousands", () => {
    expect(valueFormatterSpend(1_000)).toBe("1k tokens");
    expect(valueFormatterSpend(5_500)).toBe("5.5k tokens");
    expect(valueFormatterSpend(999_999)).toBe("999.999k tokens");
  });

  it("should format numbers below 1,000 as plain token counts", () => {
    expect(valueFormatterSpend(1)).toBe("1 tokens");
    expect(valueFormatterSpend(99.99)).toBe("99.99 tokens");
    expect(valueFormatterSpend(999)).toBe("999 tokens");
  });

  it("should treat exactly 1,000,000 as the millions boundary", () => {
    expect(valueFormatterSpend(1_000_000)).toBe("1M tokens");
  });

  it("should treat exactly 1,000 as the thousands boundary", () => {
    expect(valueFormatterSpend(1_000)).toBe("1k tokens");
  });
});
