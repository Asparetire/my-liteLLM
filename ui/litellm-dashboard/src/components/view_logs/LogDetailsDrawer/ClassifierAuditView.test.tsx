import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClassifierAuditView } from "./ClassifierAuditView";

vi.mock("./JsonViewer", () => ({
  JsonViewer: ({ data }: { data: unknown }) => <pre>{JSON.stringify(data)}</pre>,
}));

describe("ClassifierAuditView", () => {
  it("separates and copies the provider input, source request, and returned verdict", async () => {
    const user = userEvent.setup();
    const input = { system: "classification rubric", messages: [{ role: "user", content: "classify this" }] };
    render(
      <ClassifierAuditView
        request={{ classifier_input: input, originating_request_masked: { input: "source-only", api_key: "REDACTED" } }}
        response={{ tier: "SIMPLE", reason: "a greeting" }}
      />,
    );
    const classifier = within(screen.getByRole("region", { name: "分类器输入" }));
    expect(classifier.getByText(/classification rubric/)).toBeInTheDocument();
    expect(classifier.queryByText(/source-only/)).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "原始请求（凭据已脱敏）" })).getByText(/source-only/),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "分类器响应" })).getByText(/a greeting/),
    ).toBeInTheDocument();
    await user.click(classifier.getByRole("button", { name: "复制分类器输入" }));
    expect(await navigator.clipboard.readText()).toBe(JSON.stringify(input, null, 2));
  });

  it("does not present legacy source messages as captured classifier input", () => {
    render(<ClassifierAuditView request={{ messages: [{ content: "legacy source" }] }} response={undefined} />);
    expect(screen.getAllByText("未捕获或未开启消息日志")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "复制分类器输入" })).not.toBeInTheDocument();
  });

  it("labels truncated input without marking a complete source request as truncated", () => {
    render(
      <ClassifierAuditView
        request={{
          classifier_input: { system: "partial rubric...litellm_truncated" },
          originating_request_masked: { input: "source" },
        }}
        response={{ tier: "SIMPLE" }}
      />,
    );
    expect(within(screen.getByRole("region", { name: "分类器输入" })).getByRole("status")).toHaveTextContent(
      "该存储副本已被截断，完整载荷无法从所配置的日志存储中获取",
    );
    expect(
      within(screen.getByRole("region", { name: "原始请求（凭据已脱敏）" })).queryByRole("status"),
    ).not.toBeInTheDocument();
  });
});
