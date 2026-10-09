import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import TruePassthroughWarning from "./TruePassthroughWarning";
import { AUTH_TYPE } from "@/components/mcp_tools/types";

describe("TruePassthroughWarning", () => {
  it("warns when auth type is true_passthrough", () => {
    render(<TruePassthroughWarning authType={AUTH_TYPE.TRUE_PASSTHROUGH} />);

    expect(screen.getByText("True Passthrough 将对该服务器禁用 LiteLLM 认证")).toBeInTheDocument();
    expect(screen.getByText(/无需 LiteLLM 密钥即可调用此服务器/)).toBeInTheDocument();
  });

  it("renders nothing for any other auth type", () => {
    const { container } = render(<TruePassthroughWarning authType={AUTH_TYPE.OAUTH2} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when no auth type is set", () => {
    const { container } = render(<TruePassthroughWarning authType={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
