import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PassthroughAuthorizeSection from "./PassthroughAuthorizeSection";
import { McpFormHarness } from "./McpFormTestHarness";

const WithForm = McpFormHarness;

const noopFlow = { startOAuthFlow: () => {}, status: "idle", error: null, tokenResponse: null };

describe("PassthroughAuthorizeSection credential-class-aware copy", () => {
  it("shows keep-existing copy when the credential class is unchanged (true_passthrough <-> oauth_delegate)", () => {
    render(
      <WithForm>
        <PassthroughAuthorizeSection
          authType="oauth_delegate"
          oauthFlow={noopFlow}
          isEditing
          savedAuthType="true_passthrough"
        />
      </WithForm>,
    );
    expect(screen.getByPlaceholderText("留空保持已保存的应用（如有）")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("留空保持已保存的 secret（如有）")).toBeInTheDocument();
  });

  it("shows the discard warning copy when switching from a different class (oauth2 -> true_passthrough)", () => {
    render(
      <WithForm>
        <PassthroughAuthorizeSection
          authType="true_passthrough"
          oauthFlow={noopFlow}
          isEditing
          savedAuthType="oauth2"
        />
      </WithForm>,
    );
    expect(screen.getByPlaceholderText("留空则使用动态客户端注册")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("留空适用于 public client / PKCE")).toBeInTheDocument();
    expect(screen.getByText(/切换认证方式会丢弃之前保存的应用/)).toBeInTheDocument();
  });

  it("shows the keep+warn banner when the upstream may no longer match", () => {
    render(
      <WithForm>
        <PassthroughAuthorizeSection authType="true_passthrough" oauthFlow={noopFlow} appMayNotMatchUpstream />
      </WithForm>,
    );
    expect(screen.getByText(/可能已失效/)).toBeInTheDocument();
  });
});
