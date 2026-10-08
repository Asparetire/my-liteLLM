import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LatencyBasedConfiguration from "./LatencyBasedConfiguration";

describe("LatencyBasedConfiguration", () => {
  it("should render the section heading", () => {
    render(<LatencyBasedConfiguration routingStrategyArgs={{}} />);
    expect(screen.getByText("延迟路由配置")).toBeInTheDocument();
  });

  it("should render default params when no args are provided", () => {
    render(<LatencyBasedConfiguration routingStrategyArgs={null as any} />);
    // Default: ttl=3600, lowest_latency_buffer=0
    expect(screen.getByDisplayValue("3600")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0")).toBeInTheDocument();
  });

  it("should render the provided routing strategy args as inputs", () => {
    const args = { ttl: 7200, lowest_latency_buffer: 0.1 };
    render(<LatencyBasedConfiguration routingStrategyArgs={args} />);
    expect(screen.getByDisplayValue("7200")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0.1")).toBeInTheDocument();
  });

  it("should render an input with the correct name attribute for each param", () => {
    const args = { ttl: 3600, lowest_latency_buffer: 0 };
    render(<LatencyBasedConfiguration routingStrategyArgs={args} />);
    expect(screen.getByRole("textbox", { name: /ttl/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /lowest latency buffer/i })).toBeInTheDocument();
  });

  it("should display the TTL parameter explanation", () => {
    render(<LatencyBasedConfiguration routingStrategyArgs={null as any} />);
    expect(screen.getByText(/回看滑动窗口/)).toBeInTheDocument();
  });

  it("should display the lowest_latency_buffer parameter explanation", () => {
    render(<LatencyBasedConfiguration routingStrategyArgs={null as any} />);
    expect(screen.getByText(/在最低延迟的该百分比范围内随机挑选部署/)).toBeInTheDocument();
  });

  it("should render object values stringified into the input", () => {
    const args = { ttl: { nested: true } };
    render(<LatencyBasedConfiguration routingStrategyArgs={args} />);
    // HTML input type=text strips newlines, so check that the key/value appears
    const input = screen.getByRole("textbox", { name: /ttl/i }) as HTMLInputElement;
    expect(input.value).toContain('"nested"');
    expect(input.value).toContain("true");
  });
});
