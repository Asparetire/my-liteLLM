import React from "react";
import { describe, it, expect } from "vitest";
import userEvent from "@testing-library/user-event";
import PresidioDetectedEntities from "@/components/view_logs/GuardrailViewer/PresidioDetectedEntities";
import { renderWithProviders, screen } from "../../../../tests/test-utils";
import { makeEntity } from "@/components/view_logs/GuardrailViewer/__tests__/fixtures";

describe("PresidioDetectedEntities", () => {
  it("renders null when entities empty", () => {
    const { container } = renderWithProviders(<PresidioDetectedEntities entities={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders per-entity header info including score color and position", async () => {
    const user = userEvent.setup();
    const e = makeEntity({ start: 10, end: 20, score: 0.92, entity_type: "EMAIL_ADDRESS" });
    renderWithProviders(<PresidioDetectedEntities entities={[e]} />);

    // Header row values
    expect(screen.getByText("EMAIL_ADDRESS")).toBeInTheDocument();
    expect(screen.getByText(/得分：0\.92/)).toBeInTheDocument();
    expect(screen.getByText("位置：10-20")).toBeInTheDocument();

    // Expand details
    await user.click(screen.getByText("EMAIL_ADDRESS"));
    expect(screen.getByText("实体类型：")).toBeInTheDocument();
    expect(screen.getByText("字符 10-20")).toBeInTheDocument();
    expect(screen.getByText("置信度：")).toBeInTheDocument();
    // Recognizer details
    expect(screen.getByText("EmailRecognizer")).toBeInTheDocument();
    expect(screen.getByText("email_v1")).toBeInTheDocument();
    // Explanation
    expect(screen.getByText("Matched via pattern")).toBeInTheDocument();
  });

  it("handles missing metadata & low scores gracefully", async () => {
    const user = userEvent.setup();
    const e = makeEntity({
      score: 0.3,
      recognition_metadata: undefined as any,
      analysis_explanation: null,
      entity_type: "NAME",
      start: 0,
      end: 0,
    });
    renderWithProviders(<PresidioDetectedEntities entities={[e]} />);

    await user.click(screen.getByText("NAME"));
    // No recognizer/explanation rows
    expect(screen.queryByText("识别器：")).not.toBeInTheDocument();
    expect(screen.queryByText("解释：")).not.toBeInTheDocument();
    // Position still renders
    expect(screen.getByText("字符 0-0")).toBeInTheDocument();
  });
});
