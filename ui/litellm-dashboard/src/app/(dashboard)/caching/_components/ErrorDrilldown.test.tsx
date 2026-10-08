import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorCodeTooltip, groupErrorBuckets, FAILED_REQUESTS_SERIES, type CacheActivityErrorBucket } from "./ErrorDrilldown";

const BUCKETS: CacheActivityErrorBucket[] = [
  { call_type: "acompletion", error_code: "401", error_class: "AuthenticationError", count: 50 },
  { call_type: "acompletion", error_code: "429", error_class: "RateLimitError", count: 120 },
  { call_type: "acompletion", error_code: "429", error_class: "InternalServerError", count: 30 },
  { call_type: "aembedding", error_code: "500", error_class: "InternalServerError", count: 999 },
];

describe("groupErrorBuckets", () => {
  it("keeps only the requested call_type, totals per code, and sorts codes and classes by count desc", () => {
    expect(groupErrorBuckets(BUCKETS, "acompletion")).toEqual([
      {
        error_code: "429",
        [FAILED_REQUESTS_SERIES]: 150,
        classes: [
          { error_class: "RateLimitError", count: 120 },
          { error_class: "InternalServerError", count: 30 },
        ],
      },
      {
        error_code: "401",
        [FAILED_REQUESTS_SERIES]: 50,
        classes: [{ error_class: "AuthenticationError", count: 50 }],
      },
    ]);
  });

  it("returns no data for a call_type without failures", () => {
    expect(groupErrorBuckets(BUCKETS, "atranscription")).toEqual([]);
  });
});

describe("ErrorCodeTooltip", () => {
  const datum = groupErrorBuckets(BUCKETS, "acompletion")[0];

  it("shows the code total and one row per error class on hover", () => {
    render(<ErrorCodeTooltip active label="429" payload={[{ payload: datum, value: 150, graphicalItemId: "bar" }]} />);

    expect(screen.getByText("错误码 429：150 次失败")).toBeInTheDocument();
    expect(screen.getByText("RateLimitError")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("InternalServerError")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("renders nothing when inactive", () => {
    const { container } = render(<ErrorCodeTooltip active={false} label="429" payload={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
