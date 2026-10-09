import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import OAuthFormFields from "./OAuthFormFields";
import { McpFormHarness as WithForm } from "./McpFormTestHarness";

// ── tests ─────────────────────────────────────────────────────────────────────

describe("OAuthFormFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── visibility by flow type ─────────────────────────────────────────────────

  // The RFC 8707 resource indicator applies to both OAuth arms: the interactive authorize/token legs
  // and the M2M client_credentials fetch. It must render in each, or the arm missing it can only be
  // configured through the API.
  describe("resource indicator field", () => {
    it("renders in interactive mode", () => {
      render(
        <WithForm>
          <OAuthFormFields isM2M={false} />
        </WithForm>,
      );
      expect(screen.getByText("Resource Indicator（可选）")).toBeInTheDocument();
    });

    it("renders in M2M mode", () => {
      render(
        <WithForm>
          <OAuthFormFields isM2M={true} />
        </WithForm>,
      );
      expect(screen.getByText("Resource Indicator（可选）")).toBeInTheDocument();
    });

    it("keeps one placeholder when editing, since the stored value is returned and shown", () => {
      // Non-secret admin config is no longer redacted out of responses, so the field mounts with its
      // real value and an emptied field clears it. There is no keep-existing state left to signal.
      render(
        <WithForm>
          <OAuthFormFields isM2M={false} isEditing={true} />
        </WithForm>,
      );
      expect(screen.getByPlaceholderText("auto 或 https://mcp.example.com/mcp")).toBeInTheDocument();
    });

    it("submits its value under credentials.upstream_resource", async () => {
      const onFinish = vi.fn();
      render(
        <WithForm onFinish={onFinish}>
          <OAuthFormFields isM2M={false} />
        </WithForm>,
      );
      const input = screen.getByPlaceholderText("auto 或 https://mcp.example.com/mcp");
      await act(async () => {
        fireEvent.change(input, { target: { value: "api://finance-api/.default" } });
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Submit"));
      });
      await waitFor(() => {
        expect(onFinish).toHaveBeenCalledWith(
          expect.objectContaining({
            credentials: expect.objectContaining({ upstream_resource: "api://finance-api/.default" }),
          }),
        );
      });
    });
  });

  describe("interactive mode (isM2M=false)", () => {
    it("renders Token Validation Rules field", () => {
      render(
        <WithForm>
          <OAuthFormFields isM2M={false} />
        </WithForm>,
      );
      expect(screen.getByText("Token 校验规则（可选）")).toBeInTheDocument();
    });

    it("renders Token Storage TTL field", () => {
      render(
        <WithForm>
          <OAuthFormFields isM2M={false} />
        </WithForm>,
      );
      expect(screen.getByText("Token 存储 TTL（秒，可选）")).toBeInTheDocument();
    });

    it("renders standard interactive fields alongside the new fields", () => {
      render(
        <WithForm>
          <OAuthFormFields isM2M={false} />
        </WithForm>,
      );
      expect(screen.getByText("Authorization URL（可选）")).toBeInTheDocument();
      expect(screen.getByText("Registration URL（可选）")).toBeInTheDocument();
      expect(screen.getByText("Token 校验规则（可选）")).toBeInTheDocument();
      expect(screen.getByText("Token 存储 TTL（秒，可选）")).toBeInTheDocument();
    });
  });

  describe("M2M mode (isM2M=true)", () => {
    it("does NOT render Token Validation Rules field", () => {
      render(
        <WithForm>
          <OAuthFormFields isM2M={true} />
        </WithForm>,
      );
      expect(screen.queryByText("Token 校验规则（可选）")).not.toBeInTheDocument();
    });

    it("does NOT render Token Storage TTL field", () => {
      render(
        <WithForm>
          <OAuthFormFields isM2M={true} />
        </WithForm>,
      );
      expect(screen.queryByText("Token 存储 TTL（秒，可选）")).not.toBeInTheDocument();
    });

    it("still renders M2M-specific fields", () => {
      render(
        <WithForm>
          <OAuthFormFields isM2M={true} />
        </WithForm>,
      );
      expect(screen.getByText("Client ID")).toBeInTheDocument();
      expect(screen.getByText("Token URL")).toBeInTheDocument();
    });
  });

  describe("token endpoint auth method selector", () => {
    it("renders directly below the Token URL field in interactive mode", () => {
      render(
        <WithForm>
          <OAuthFormFields isM2M={false} />
        </WithForm>,
      );
      const tokenUrlLabel = screen.getByText("Token URL（可选）");
      const authMethodLabel = screen.getByText("Token Endpoint 认证方式（可选）");
      expect(tokenUrlLabel.compareDocumentPosition(authMethodLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("renders directly below the Token URL field in M2M mode", () => {
      render(
        <WithForm>
          <OAuthFormFields isM2M={true} />
        </WithForm>,
      );
      const tokenUrlLabel = screen.getByText("Token URL");
      const authMethodLabel = screen.getByText("Token Endpoint 认证方式（可选）");
      expect(tokenUrlLabel.compareDocumentPosition(authMethodLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("offers client_secret_basic and client_secret_post options", async () => {
      render(
        <WithForm>
          <OAuthFormFields isM2M={false} />
        </WithForm>,
      );
      const selector = screen.getByLabelText("Token Endpoint 认证方式（可选）");
      await act(async () => {
        fireEvent.mouseDown(selector);
      });
      await waitFor(() => {
        expect(screen.getByText("Client Secret Basic")).toBeInTheDocument();
        expect(screen.getByText("Client Secret Post")).toBeInTheDocument();
      });
    });
  });

  // ── token_validation_json inline JSON validator ──────────────────────────────

  describe("token_validation_json validation", () => {
    it("accepts empty value without error", async () => {
      const onFinish = vi.fn();
      render(
        <WithForm onFinish={onFinish}>
          <OAuthFormFields isM2M={false} />
        </WithForm>,
      );

      // Leave the textarea empty and submit
      const submitBtn = screen.getByRole("button", { name: "Submit" });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(screen.queryByText("必须是有效的 JSON")).not.toBeInTheDocument();
      });
    });

    it("accepts a valid JSON object without error", async () => {
      render(
        <WithForm>
          <OAuthFormFields isM2M={false} />
        </WithForm>,
      );

      const textarea = document.getElementById("token_validation_json") as HTMLTextAreaElement;
      await act(async () => {
        fireEvent.change(textarea, { target: { value: '{"organization": "my-org"}' } });
      });

      const submitBtn = screen.getByRole("button", { name: "Submit" });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(screen.queryByText("必须是有效的 JSON")).not.toBeInTheDocument();
      });
    });

    it("shows 'Must be valid JSON' error for malformed JSON", async () => {
      render(
        <WithForm>
          <OAuthFormFields isM2M={false} />
        </WithForm>,
      );

      const textarea = document.getElementById("token_validation_json") as HTMLTextAreaElement;
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "not-valid-json{" } });
      });

      const submitBtn = screen.getByRole("button", { name: "Submit" });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText("必须是有效的 JSON")).toBeInTheDocument();
      });
    });

    it("shows error for a plain string value (not a JSON object)", async () => {
      render(
        <WithForm>
          <OAuthFormFields isM2M={false} />
        </WithForm>,
      );

      const textarea = document.getElementById("token_validation_json") as HTMLTextAreaElement;
      await act(async () => {
        // A bare string is valid JSON but we still want to accept it; only truly
        // unparseable text should fail.  Bare "hello" is actually invalid JSON
        // (no quotes), so it should fail.
        fireEvent.change(textarea, { target: { value: "hello" } });
      });

      const submitBtn = screen.getByRole("button", { name: "Submit" });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText("必须是有效的 JSON")).toBeInTheDocument();
      });
    });

    it("whitespace-only value is treated as empty and passes validation", async () => {
      const onFinish = vi.fn();
      render(
        <WithForm onFinish={onFinish}>
          <OAuthFormFields isM2M={false} />
        </WithForm>,
      );

      const textarea = document.getElementById("token_validation_json") as HTMLTextAreaElement;
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "   " } });
      });

      const submitBtn = screen.getByRole("button", { name: "Submit" });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(screen.queryByText("必须是有效的 JSON")).not.toBeInTheDocument();
      });
    });
  });

  describe("token header field", () => {
    it("renders on the M2M flow", () => {
      render(
        <WithForm>
          <OAuthFormFields isM2M={true} />
        </WithForm>,
      );
      expect(screen.getByPlaceholderText("Authorization")).toBeInTheDocument();
    });

    it("renders on the interactive flow", () => {
      render(
        <WithForm>
          <OAuthFormFields isM2M={false} />
        </WithForm>,
      );
      expect(screen.getByPlaceholderText("Authorization")).toBeInTheDocument();
    });

    it("submits its value under credentials.upstream_token_header", async () => {
      const onFinish = vi.fn();
      render(
        <WithForm onFinish={onFinish}>
          <OAuthFormFields isM2M={true} />
        </WithForm>,
      );
      fireEvent.change(screen.getByPlaceholderText("Authorization"), { target: { value: "esb-oauth" } });
      fireEvent.click(screen.getByText("Submit"));
      await waitFor(() => {
        expect(onFinish).toHaveBeenCalledWith(
          expect.objectContaining({
            credentials: expect.objectContaining({ upstream_token_header: "esb-oauth" }),
          }),
        );
      });
    });
  });
});
