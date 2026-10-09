import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MCPToolConfiguration from "./mcp_tool_configuration";

const tools = [
  { name: "read_user", description: "Read user" },
  { name: "delete_user", description: "Delete user" },
];

const renderToolConfiguration = (onAllowedToolsChange = vi.fn()) => {
  render(
    <MCPToolConfiguration
      accessToken="token"
      formValues={{ url: "https://example.com/mcp", transport: "http", auth_type: "none" }}
      allowedTools={[]}
      existingAllowedTools={null}
      onAllowedToolsChange={onAllowedToolsChange}
      toolNameToDisplayName={{}}
      toolNameToDescription={{}}
      onToolNameToDisplayNameChange={vi.fn()}
      onToolNameToDescriptionChange={vi.fn()}
      externalTools={tools}
      externalCanFetch
      isEditMode
    />,
  );

  return onAllowedToolsChange;
};

describe("MCPToolConfiguration", () => {
  it("shows legacy unrestricted edit tools enabled in flat view", async () => {
    const onAllowedToolsChange = renderToolConfiguration();

    fireEvent.click(screen.getByText("平铺列表"));

    expect(screen.getByText("2 / 2 个工具已开放用户调用")).toBeInTheDocument();
    expect(screen.getAllByText("已启用")).toHaveLength(2);

    fireEvent.click(screen.getByText("read_user"));

    await waitFor(() => {
      expect(onAllowedToolsChange).toHaveBeenLastCalledWith(["delete_user"]);
    });
  });

  it("preserves a restored selection on a legacy server instead of clearing it on init", async () => {
    const onAllowedToolsChange = vi.fn();

    render(
      <MCPToolConfiguration
        accessToken="token"
        formValues={{ url: "https://example.com/mcp", transport: "http", auth_type: "none" }}
        allowedTools={["read_user"]}
        existingAllowedTools={null}
        hasToolAllowlistInteraction
        onAllowedToolsChange={onAllowedToolsChange}
        toolNameToDisplayName={{}}
        toolNameToDescription={{}}
        onToolNameToDisplayNameChange={vi.fn()}
        onToolNameToDescriptionChange={vi.fn()}
        externalTools={tools}
        externalCanFetch
        isEditMode
      />,
    );

    await waitFor(() => {
      expect(onAllowedToolsChange).toHaveBeenCalled();
    });
    expect(onAllowedToolsChange).toHaveBeenLastCalledWith(["read_user"]);
    expect(onAllowedToolsChange).not.toHaveBeenCalledWith([]);
  });

  it("keeps legacy unrestricted tools disabled after all are toggled off", async () => {
    const Wrapper = () => {
      const [allowedTools, setAllowedTools] = useState<string[]>([]);
      const [hasToolAllowlistInteraction, setHasToolAllowlistInteraction] = useState(false);

      return (
        <MCPToolConfiguration
          accessToken="token"
          formValues={{ url: "https://example.com/mcp", transport: "http", auth_type: "none" }}
          allowedTools={allowedTools}
          existingAllowedTools={null}
          hasToolAllowlistInteraction={hasToolAllowlistInteraction}
          onToolAllowlistInteraction={() => setHasToolAllowlistInteraction(true)}
          onAllowedToolsChange={setAllowedTools}
          toolNameToDisplayName={{}}
          toolNameToDescription={{}}
          onToolNameToDisplayNameChange={vi.fn()}
          onToolNameToDescriptionChange={vi.fn()}
          externalTools={tools}
          externalCanFetch
          isEditMode
        />
      );
    };

    render(<Wrapper />);

    fireEvent.click(screen.getByText("平铺列表"));
    fireEvent.click(screen.getByText("read_user"));
    fireEvent.click(screen.getByText("delete_user"));

    await waitFor(() => {
      expect(screen.getByText("0 / 2 个工具已开放用户调用")).toBeInTheDocument();
      expect(screen.getAllByText("已禁用")).toHaveLength(2);
    });
  });

  it("shows a validation error for a display name containing a space", async () => {
    const Wrapper = () => {
      const [toolNameToDisplayName, setToolNameToDisplayName] = useState<Record<string, string>>({});

      return (
        <MCPToolConfiguration
          accessToken="token"
          formValues={{ url: "https://example.com/mcp", transport: "http", auth_type: "none" }}
          allowedTools={[]}
          existingAllowedTools={null}
          onAllowedToolsChange={vi.fn()}
          toolNameToDisplayName={toolNameToDisplayName}
          toolNameToDescription={{}}
          onToolNameToDisplayNameChange={setToolNameToDisplayName}
          onToolNameToDescriptionChange={vi.fn()}
          externalTools={tools}
          externalCanFetch
          isEditMode
        />
      );
    };

    render(<Wrapper />);

    fireEvent.click(screen.getByText("平铺列表"));
    fireEvent.click(screen.getAllByTitle("编辑显示名称与描述")[0]);

    const input = screen.getByPlaceholderText("read_user");
    fireEvent.change(input, { target: { value: "Browse Repo Docs" } });

    await waitFor(() => {
      expect(
        screen.getByText("仅允许字母、数字、下划线和连字符（不能有空格）。"),
      ).toBeInTheDocument();
    });
  });

  it("accepts a Bedrock-safe display name without showing a validation error", async () => {
    const Wrapper = () => {
      const [toolNameToDisplayName, setToolNameToDisplayName] = useState<Record<string, string>>({});

      return (
        <MCPToolConfiguration
          accessToken="token"
          formValues={{ url: "https://example.com/mcp", transport: "http", auth_type: "none" }}
          allowedTools={[]}
          existingAllowedTools={null}
          onAllowedToolsChange={vi.fn()}
          toolNameToDisplayName={toolNameToDisplayName}
          toolNameToDescription={{}}
          onToolNameToDisplayNameChange={setToolNameToDisplayName}
          onToolNameToDescriptionChange={vi.fn()}
          externalTools={tools}
          externalCanFetch
          isEditMode
        />
      );
    };

    render(<Wrapper />);

    fireEvent.click(screen.getByText("平铺列表"));
    fireEvent.click(screen.getAllByTitle("编辑显示名称与描述")[0]);

    const input = screen.getByPlaceholderText("read_user");
    fireEvent.change(input, { target: { value: "browse_repo_docs" } });

    await waitFor(() => {
      expect(
        screen.queryByText("仅允许字母、数字、下划线和连字符（不能有空格）。"),
      ).not.toBeInTheDocument();
    });
  });
});
