import React from "react";
import { describe, it, expect } from "vitest";
import BedrockGuardrailDetails, {
  BedrockGuardrailResponse,
} from "@/components/view_logs/GuardrailViewer/BedrockGuardrailDetails";
import { renderWithProviders, screen } from "../../../../tests/test-utils";
import {
  makeAssessment,
  makeBedrockCoverage,
  makeBedrockResponse,
  makeBedrockUsage,
} from "@/components/view_logs/GuardrailViewer/__tests__/fixtures";

describe("BedrockGuardrailDetails", () => {
  it("returns null when response is falsy", () => {
    // @ts-expect-error testing nullish handling
    const { container } = renderWithProviders(<BedrockGuardrailDetails response={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders top summary: action chip, reason, blocked response", () => {
    const resp: BedrockGuardrailResponse = makeBedrockResponse({
      action: "GUARDRAIL_INTERVENED",
      actionReason: "Policy violation",
      blockedResponse: "[blocked]",
    });
    renderWithProviders(<BedrockGuardrailDetails response={resp} />);

    expect(screen.getByText("动作：")).toBeInTheDocument();
    expect(screen.getByText("Policy violation")).toBeInTheDocument();
    expect(screen.getByText("[blocked]")).toBeInTheDocument();
  });

  it("renders coverage and usage pills", () => {
    const resp = makeBedrockResponse({
      guardrailCoverage: makeBedrockCoverage(),
      usage: makeBedrockUsage({ contentPolicyUnits: 7, wordPolicyUnits: 1 }),
    });
    renderWithProviders(<BedrockGuardrailDetails response={resp} />);

    expect(screen.getByText(/文本防护 27\/100/)).toBeInTheDocument();
    expect(screen.getByText(/图像防护 1\/3/)).toBeInTheDocument();
    expect(screen.getByText(/contentPolicyUnits: 7/)).toBeInTheDocument();
    expect(screen.getByText(/wordPolicyUnits: 1/)).toBeInTheDocument();
  });

  it("renders outputs when present (prefers `outputs`, falls back to `output`)", () => {
    // Using outputs
    let resp = makeBedrockResponse({ outputs: [{ text: "hello" }] });
    const { rerender } = renderWithProviders(<BedrockGuardrailDetails response={resp} />);
    expect(screen.getByText("输出")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();

    // Using output
    resp = makeBedrockResponse({ outputs: undefined, output: [{ text: "world" }] });
    rerender(<BedrockGuardrailDetails response={resp} />);
    expect(screen.getByText("world")).toBeInTheDocument();
  });

  it("renders assessments with all policy sections and metrics", () => {
    const resp = makeBedrockResponse({
      assessments: [makeAssessment()],
    });
    renderWithProviders(<BedrockGuardrailDetails response={resp} />);

    // Assessment section present
    expect(screen.getByText("评估 #1")).toBeInTheDocument();

    // Word policy sections
    expect(screen.getByText("词语策略")).toBeInTheDocument();
    expect(screen.getByText("自定义词语")).toBeInTheDocument();
    expect(screen.getByText("托管词表")).toBeInTheDocument();

    // Contextual grounding table headers
    expect(screen.getByText("上下文锚定")).toBeInTheDocument();
    expect(screen.getAllByText("得分").length).toBeGreaterThan(0);
    expect(screen.getAllByText("阈值").length).toBeGreaterThan(0);

    // Sensitive Info sections
    expect(screen.getByText("敏感信息")).toBeInTheDocument();
    expect(screen.getByText("PII 实体")).toBeInTheDocument();
    expect(screen.getByText("自定义正则")).toBeInTheDocument();

    // Topic Policy
    expect(screen.getByText("主题策略")).toBeInTheDocument();
    expect(screen.getByText("weapons")).toBeInTheDocument();

    // Invocation Metrics
    expect(screen.getByText("调用指标")).toBeInTheDocument();

    // Raw JSON section exists (closed by default)
    expect(screen.getByText("Bedrock 护栏原始响应")).toBeInTheDocument();
  });

  it("handles non-text outputs gracefully", () => {
    const resp = makeBedrockResponse({ outputs: [{}, { text: "texty" }] });
    renderWithProviders(<BedrockGuardrailDetails response={resp} />);
    expect(screen.getByText("（非文本输出）")).toBeInTheDocument();
    expect(screen.getByText("texty")).toBeInTheDocument();
  });

  it("gracefully handles missing optional sections", () => {
    const resp = makeBedrockResponse({
      assessments: [
        {
          // only include minimal fields; others omitted
          invocationMetrics: { guardrailProcessingLatency: 5 },
        } as any,
      ],
      usage: undefined,
      guardrailCoverage: undefined,
      outputs: [],
    });
    renderWithProviders(<BedrockGuardrailDetails response={resp} />);
    // No crash, minimal render: Assessment + Invocation Metrics present, but no usage/coverage chips at top
    expect(screen.getByText("评估 #1")).toBeInTheDocument();
  });
});
