import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "@/components/shared/DataTable";
import zhCN from "../../../messages/zh-CN.json";
import { getAgentHubTableColumns, AgentHubData } from "./AgentHubTableColumns";

// Resolve through the real zh-CN messages so header/count assertions pin the translated
// output, mirroring the global next-intl mock that component-level hooks resolve through.
const zhAiHub = (zhCN as { aiHub: Record<string, string> }).aiHub;
const t = ((key: string, values?: Record<string, string | number>) => {
  let message = zhAiHub[key] ?? key;
  for (const [name, value] of Object.entries(values ?? {})) {
    message = message.split(`{${name}}`).join(String(value));
  }
  return message;
}) as unknown as Parameters<typeof getAgentHubTableColumns>[0]["t"];

const mockAgent: AgentHubData = {
  agent_id: "agent-1",
  protocolVersion: "1.0",
  name: "Test Agent",
  description: "A test agent for unit testing",
  url: "https://agent.example.com",
  version: "2.0",
  capabilities: { streaming: true, caching: false },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text", "image"],
  skills: [
    { id: "s1", name: "Skill One", description: "First skill" },
    { id: "s2", name: "Skill Two", description: "Second skill" },
    { id: "s3", name: "Skill Three", description: "Third skill" },
  ],
  is_public: true,
};

function renderTable(data: AgentHubData[], onAgentClick = vi.fn()) {
  render(
    <DataTable
      data={data}
      columns={getAgentHubTableColumns({ onAgentClick, t })}
      getRowId={(agent, index) => agent.agent_id || String(index)}
      sortingMode="client"
      size="compact"
    />,
  );
  return onAgentClick;
}

describe("getAgentHubTableColumns", () => {
  it("should render", () => {
    renderTable([mockAgent]);
    expect(screen.getByText("Test Agent")).toBeInTheDocument();
  });

  it("should display the agent description", () => {
    renderTable([mockAgent]);
    expect(screen.getByText("A test agent for unit testing")).toBeInTheDocument();
  });

  it("should display the version with a 'v' prefix", () => {
    renderTable([mockAgent]);
    expect(screen.getByText("v2.0")).toBeInTheDocument();
  });

  it("should display the protocol version", () => {
    renderTable([mockAgent]);
    expect(screen.getByText("1.0")).toBeInTheDocument();
  });

  it("should show the skill count", () => {
    renderTable([mockAgent]);
    expect(screen.getByText("3 个技能")).toBeInTheDocument();
  });

  it("should show first two skills and '+1' for overflow", () => {
    renderTable([mockAgent]);
    expect(screen.getByText("Skill One")).toBeInTheDocument();
    expect(screen.getByText("Skill Two")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("should show only true capabilities as badges", () => {
    renderTable([mockAgent]);
    expect(screen.getByText("streaming")).toBeInTheDocument();
    expect(screen.queryByText("caching")).not.toBeInTheDocument();
  });

  it("should display I/O modes", () => {
    renderTable([mockAgent]);
    const inLabel = screen.getByText("输入：");
    expect(inLabel.parentElement?.textContent).toBe("输入： text");
    const outLabel = screen.getByText("输出：");
    expect(outLabel.parentElement?.textContent).toBe("输出： text, image");
  });

  it("should display the public badge for public agents", () => {
    renderTable([mockAgent]);
    expect(screen.getByText("是")).toBeInTheDocument();
  });

  it("should display the non-public badge for non-public agents", () => {
    renderTable([{ ...mockAgent, is_public: false }]);
    expect(screen.getByText("否")).toBeInTheDocument();
  });

  it("should open the agent details when the name is clicked", async () => {
    const user = userEvent.setup();
    const onAgentClick = renderTable([mockAgent]);
    await user.click(screen.getByRole("button", { name: "Test Agent" }));
    expect(onAgentClick).toHaveBeenCalledWith(mockAgent);
  });

  it("should open the agent details from the actions menu", async () => {
    const user = userEvent.setup();
    const onAgentClick = renderTable([mockAgent]);
    await user.click(screen.getByTestId("agent-hub-actions-agent-1"));
    await user.click(await screen.findByTestId("agent-hub-action-details"));
    expect(onAgentClick).toHaveBeenCalledWith(mockAgent);
  });

  it("should copy the agent name from the actions menu", async () => {
    const user = userEvent.setup();
    renderTable([mockAgent]);
    await user.click(screen.getByTestId("agent-hub-actions-agent-1"));
    await user.click(await screen.findByTestId("agent-hub-action-copy"));
    expect(await window.navigator.clipboard.readText()).toBe("Test Agent");
  });

  it("should show '-' when agent has no capabilities", () => {
    renderTable([{ ...mockAgent, capabilities: {} }]);
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(1);
  });

  it("should show the count for a single skill", () => {
    renderTable([{ ...mockAgent, skills: [{ id: "s1", name: "Only Skill", description: "One" }] }]);
    expect(screen.getByText("1 个技能")).toBeInTheDocument();
  });
});
