import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RoutingDecisionCard, type RoutingDecision } from "./RoutingDecisionCard";

const heuristic: RoutingDecision = {
  router_model_name: "smart-router",
  router_type: "complexity",
  routed_model: "claude-sonnet",
  cause: "heuristic_scorer",
  tier: "REASONING",
  score: 0.82,
  signals: ["long (900 tokens)", "code (python, function)"],
  tier_boundaries: { simple_medium: 0.15, medium_complex: 0.35, complex_reasoning: 0.6 },
};

describe("RoutingDecisionCard", () => {
  it("renders nothing when the request carried no routing decision", () => {
    const { container } = render(<RoutingDecisionCard decision={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("explains a heuristic score against the boundaries that were in effect", () => {
    render(<RoutingDecisionCard decision={heuristic} />);
    expect(screen.getByText("smart-router")).toBeInTheDocument();
    expect(screen.getByText("(自动路由器 v2)")).toBeInTheDocument();
    expect(screen.getByText("REASONING")).toBeInTheDocument();
    expect(screen.getByText("启发式打分器")).toBeInTheDocument();
    expect(screen.getByText("0.82")).toBeInTheDocument();
    expect(screen.getByText("(0.6 及以上，REASONING)")).toBeInTheDocument();
    expect(screen.getByText("claude-sonnet")).toBeInTheDocument();
    expect(screen.getByText("long (900 tokens)")).toBeInTheDocument();
  });

  it("uses the persisted boundary snapshot, not today's defaults", () => {
    // Same score, boundaries the operator had configured lower: it lands in a
    // different band, and the card must say so.
    render(
      <RoutingDecisionCard
        decision={{
          ...heuristic,
          score: 0.4,
          tier: "REASONING",
          tier_boundaries: { simple_medium: 0.1, medium_complex: 0.2, complex_reasoning: 0.3 },
        }}
      />,
    );
    expect(screen.getByText("(0.3 及以上，REASONING)")).toBeInTheDocument();
  });

  it("labels a reasoning override and does not claim the score met a boundary", () => {
    render(
      <RoutingDecisionCard
        decision={{
          ...heuristic,
          cause: "reasoning_override",
          score: 0.2,
          signals: ["reasoning (prove, step-by-step)"],
        }}
      />,
    );
    expect(
      screen.getByText(
        "启发式 REASONING 覆盖（2 个及以上推理标记，得分不低于 Simple 到 Medium 边界）",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("0.20")).toBeInTheDocument();
    // The score did not decide this tier, so NO band explanation may render at all.
    // Asserting the absence of one specific band would pass vacuously: 0.20 sits in
    // the MEDIUM band, so the REASONING wording is absent either way.
    expect(screen.queryByText(/\d 及以上|\d 至 \d|低于 \d/)).not.toBeInTheDocument();
  });

  it("names the judge model on the LLM classifier path and shows no score", () => {
    render(
      <RoutingDecisionCard
        decision={{
          router_model_name: "llm-router",
          router_type: "complexity",
          routed_model: "claude-sonnet",
          cause: "llm_classifier",
          tier: "REASONING",
          classifier_model: "claude-haiku",
          signals: ["llm-classifier:REASONING"],
        }}
      />,
    );
    expect(screen.getByText("LLM 分类器（claude-haiku）")).toBeInTheDocument();
    expect(screen.queryByText("得分")).not.toBeInTheDocument();
  });

  it("explains a route that fell back to the default model after the classifier failed", () => {
    // No tier is recorded on this path, so the card must not show a Tier row: nothing
    // about the request produced one, the classifier never answered.
    render(
      <RoutingDecisionCard
        decision={{
          router_model_name: "llm-router",
          router_type: "complexity",
          routed_model: "gpt-4o",
          cause: "default_model_fallback",
          signals: ["classifier-failed:default-model"],
        }}
      />,
    );
    expect(screen.getByText("默认模型，LLM 分类器失败")).toBeInTheDocument();
    expect(screen.queryByText("层级")).not.toBeInTheDocument();
  });

  it("explains a route that fell back to the configured fallback tier after the classifier failed", () => {
    render(
      <RoutingDecisionCard
        decision={{
          router_model_name: "custom-tier-router",
          router_type: "complexity",
          routed_model: "claude-sonnet",
          cause: "classifier_fallback",
          tier: "SECURITY_REVIEW",
          signals: ["classifier-fallback:SECURITY_REVIEW"],
        }}
      />,
    );
    expect(screen.getByText("兜底层级，LLM 分类器失败")).toBeInTheDocument();
    expect(screen.getByText("SECURITY_REVIEW")).toBeInTheDocument();
  });

  it("shows the keyword that fired a tier rule", () => {
    render(
      <RoutingDecisionCard
        decision={{ ...heuristic, cause: "literal_keyword_match", matched_keyword: "deploy to k8s", score: undefined }}
      />,
    );
    expect(screen.getByText("关键词匹配：“deploy to k8s”")).toBeInTheDocument();
  });

  it("shows the plan-mode sentinel that floored the tier", () => {
    render(
      <RoutingDecisionCard
        decision={{ ...heuristic, cause: "plan_mode", matched_keyword: "Plan mode is active", score: undefined }}
      />,
    );
    expect(screen.getByText("计划模式兜底：“Plan mode is active”")).toBeInTheDocument();
  });

  it("names the exit_plan_mode tool instead of quoting it as a sentinel", () => {
    render(
      <RoutingDecisionCard
        decision={{ ...heuristic, cause: "plan_mode", matched_keyword: "exit_plan_mode", score: undefined }}
      />,
    );
    expect(screen.getByText("计划模式兜底（exit_plan_mode 工具）")).toBeInTheDocument();
  });

  it("does not claim the score chose the tier on a plan-mode floored row", () => {
    // The score's band can name a lower tier than the floored badge; the cause suppresses it.
    render(
      <RoutingDecisionCard decision={{ ...heuristic, cause: "plan_mode", matched_keyword: "Plan mode is active" }} />,
    );
    expect(screen.queryByText(/低于|至 0|及以上/)).not.toBeInTheDocument();
    expect(screen.getByText("计划模式兜底：“Plan mode is active”")).toBeInTheDocument();
  });

  it("names the housekeeping sentinel so an operator can extend the pattern list", () => {
    // The sentinel is the string they would add to housekeeping_patterns to cover another
    // client, so the row is only useful if it says which one matched.
    render(
      <RoutingDecisionCard
        decision={{
          ...heuristic,
          cause: "housekeeping",
          matched_keyword: "Write the title in the predominant language of the session",
          score: undefined,
        }}
      />,
    );
    expect(screen.getByText("客户端内部维护调用：“Write the title in the predominant language of the session”")).toBeInTheDocument();
  });

  it("still labels a housekeeping row when redaction dropped the sentinel", () => {
    // matched_keyword is prompt-quoting, so message-log redaction removes it. The row must
    // still read as a housekeeping decision rather than falling back to the raw cause.
    render(<RoutingDecisionCard decision={{ ...heuristic, cause: "housekeeping", score: undefined }} />);
    expect(screen.getByText("客户端内部维护调用，已跳过分类器")).toBeInTheDocument();
    expect(screen.queryByText("housekeeping")).not.toBeInTheDocument();
  });

  it("labels a modality pin override instead of showing the raw cause token", () => {
    render(<RoutingDecisionCard decision={{ ...heuristic, cause: "modality_pin_override" }} />);
    expect(screen.getByText("因图像输入覆盖会话固定")).toBeInTheDocument();
    expect(screen.queryByText("modality_pin_override")).not.toBeInTheDocument();
  });

  it("labels a modality escalation instead of showing the raw cause token", () => {
    render(<RoutingDecisionCard decision={{ ...heuristic, cause: "modality_escalation" }} />);
    expect(screen.getByText("因图像输入升级")).toBeInTheDocument();
    expect(screen.queryByText("modality_escalation")).not.toBeInTheDocument();
  });

  it("shows the escalation keyword", () => {
    render(
      <RoutingDecisionCard decision={{ ...heuristic, escalated: true, escalation_keyword: "LITELLM ESCALATE" }} />,
    );
    expect(screen.getByText("是，关键词“LITELLM ESCALATE”")).toBeInTheDocument();
  });

  it("still shows the ask when escalation had nowhere higher to go", () => {
    // The tier did not move, but the row must not read like a request that never
    // asked to escalate.
    render(
      <RoutingDecisionCard decision={{ ...heuristic, escalated: false, escalation_keyword: "LITELLM ESCALATE" }} />,
    );
    expect(screen.getByText("通过“LITELLM ESCALATE”请求升级，但已处于最高层级")).toBeInTheDocument();
  });

  it("omits the escalation row when no escalation was requested", () => {
    render(<RoutingDecisionCard decision={heuristic} />);
    expect(screen.queryByText("已升级")).not.toBeInTheDocument();
  });

  it("still shows a ceiling escalation after the keyword is redacted away", () => {
    // Under message redaction the keyword is gone but `escalated` survives, so the
    // row must still say an escalation was requested.
    render(<RoutingDecisionCard decision={{ ...heuristic, escalated: false }} />);
    expect(screen.getByText("已请求升级，但已处于最高层级")).toBeInTheDocument();
  });

  it("does not claim the score chose the tier on a redacted override row", () => {
    // `signals` is gone under redaction; the cause alone must suppress the band.
    render(<RoutingDecisionCard decision={{ ...heuristic, cause: "reasoning_override", signals: undefined }} />);
    expect(screen.queryByText(/\d 及以上|\d 至 \d|低于 \d/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "启发式 REASONING 覆盖（2 个及以上推理标记，得分不低于 Simple 到 Medium 边界）",
      ),
    ).toBeInTheDocument();
  });

  it("shows the operator's tier name on the badge instead of the canonical one", () => {
    render(<RoutingDecisionCard decision={{ ...heuristic, tier_label: "Deep" }} />);
    expect(screen.getByText("Deep")).toBeInTheDocument();
    expect(screen.queryByText("REASONING")).not.toBeInTheDocument();
  });

  it("keeps the canonical tier name when the router did not rename it", () => {
    render(<RoutingDecisionCard decision={heuristic} />);
    expect(screen.getByText("REASONING")).toBeInTheDocument();
  });

  it("drops the tier name from the score band on a renamed router", () => {
    render(<RoutingDecisionCard decision={{ ...heuristic, tier_label: "Deep" }} />);
    expect(screen.getByText("(0.6 及以上)")).toBeInTheDocument();
    expect(screen.queryByText(/0\.6 及以上，REASONING/)).not.toBeInTheDocument();
  });

  it("uses the operator's tier name in the reasoning override description", () => {
    render(
      <RoutingDecisionCard decision={{ ...heuristic, cause: "reasoning_override", score: 0.2, tier_label: "Deep" }} />,
    );
    expect(
      screen.getByText(
        "启发式 Deep 覆盖（2 个及以上推理标记，得分不低于 Simple 到 Medium 边界）",
      ),
    ).toBeInTheDocument();
  });

  it("states the floor the override actually cleared", () => {
    render(
      <RoutingDecisionCard
        decision={{ ...heuristic, cause: "reasoning_override", score: 0.2, reasoning_override_min_score: 0.05 }}
      />,
    );
    expect(
      screen.getByText("启发式 REASONING 覆盖（2 个及以上推理标记，得分不低于 0.05）"),
    ).toBeInTheDocument();
  });

  // A floor of 0 is an unconditional override, so a falsy check here would print the "before this change"
  // wording on a row that recorded a real floor.
  it("states a recorded floor of 0 rather than treating it as unrecorded", () => {
    render(
      <RoutingDecisionCard
        decision={{ ...heuristic, cause: "reasoning_override", score: 0.2, reasoning_override_min_score: 0 }}
      />,
    );
    expect(
      screen.getByText("启发式 REASONING 覆盖（2 个及以上推理标记，得分不低于 0）"),
    ).toBeInTheDocument();
  });

  it("never prints undefined on a row logged before the floor was recorded", () => {
    render(<RoutingDecisionCard decision={{ ...heuristic, cause: "reasoning_override", score: 0.2 }} />);
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
  });

  it("falls back to the raw cause for a value this build does not know", () => {
    render(<RoutingDecisionCard decision={{ cause: "some_future_cause", routed_model: "m" }} />);
    expect(screen.getByText("some_future_cause")).toBeInTheDocument();
  });
});
