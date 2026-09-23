import * as networking from "@/components/networking";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "../../../tests/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import MemberPermissions from "./member_permissions";

vi.mock("@/components/networking", () => ({
  getTeamPermissionsCall: vi.fn(),
  teamPermissionsUpdateCall: vi.fn(),
}));

const checkboxFor = (endpoint: string) =>
  within(screen.getByText(endpoint).closest("tr") as HTMLElement).getByRole("checkbox");

describe("MemberPermissions", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should render", async () => {
    vi.mocked(networking.getTeamPermissionsCall).mockResolvedValue({
      all_available_permissions: ["/key/generate", "/key/list"],
      team_member_permissions: ["/key/generate"],
    });

    renderWithProviders(<MemberPermissions teamId="team-123" accessToken="token-123" canEditTeam={true} />);

    await waitFor(() => {
      expect(screen.getByText("成员权限")).toBeInTheDocument();
    });
  });

  it("should display permissions table when permissions are available", async () => {
    vi.mocked(networking.getTeamPermissionsCall).mockResolvedValue({
      all_available_permissions: ["/key/generate", "/key/list"],
      team_member_permissions: ["/key/generate"],
    });

    renderWithProviders(<MemberPermissions teamId="team-123" accessToken="token-123" canEditTeam={true} />);

    await waitFor(() => {
      expect(screen.getByText("方法")).toBeInTheDocument();
      expect(screen.getByText("端点")).toBeInTheDocument();
      expect(screen.getByText("描述")).toBeInTheDocument();
      expect(screen.getByText("允许访问")).toBeInTheDocument();
    });
  });

  it("should display empty state when no permissions are available", async () => {
    vi.mocked(networking.getTeamPermissionsCall).mockResolvedValue({
      all_available_permissions: [],
      team_member_permissions: [],
    });

    renderWithProviders(<MemberPermissions teamId="team-123" accessToken="token-123" canEditTeam={true} />);

    await waitFor(() => {
      expect(screen.getByText("无可用权限")).toBeInTheDocument();
    });
  });

  it("should save permissions when save button is clicked", async () => {
    vi.mocked(networking.getTeamPermissionsCall).mockResolvedValue({
      all_available_permissions: ["/key/generate", "/key/list"],
      team_member_permissions: ["/key/generate"],
    });
    vi.mocked(networking.teamPermissionsUpdateCall).mockResolvedValue({});

    renderWithProviders(<MemberPermissions teamId="team-123" accessToken="token-123" canEditTeam={true} />);

    await waitFor(() => {
      expect(screen.getByText("成员权限")).toBeInTheDocument();
    });

    expect(checkboxFor("/key/generate")).toBeChecked();
    expect(checkboxFor("/key/list")).not.toBeChecked();

    await act(async () => {
      fireEvent.click(checkboxFor("/key/list"));
    });

    expect(checkboxFor("/key/list")).toBeChecked();

    const saveButton = await screen.findByRole("button", { name: "保存更改" });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(networking.teamPermissionsUpdateCall).toHaveBeenCalledWith(
        "token-123",
        "team-123",
        expect.arrayContaining(["/key/generate", "/key/list"]),
      );
    });
  });

  it("should render team daily activity permission with correct method and description", async () => {
    vi.mocked(networking.getTeamPermissionsCall).mockResolvedValue({
      all_available_permissions: ["/key/generate", "/team/daily/activity"],
      team_member_permissions: [],
    });

    renderWithProviders(<MemberPermissions teamId="team-123" accessToken="token-123" canEditTeam={true} />);

    await waitFor(() => {
      expect(screen.getByText("/team/daily/activity")).toBeInTheDocument();
      expect(screen.getByText("成员可查看该团队的全部用量数据（不仅是自己的）")).toBeInTheDocument();
    });
  });

  it("should not show save button when canEditTeam is false", async () => {
    vi.mocked(networking.getTeamPermissionsCall).mockResolvedValue({
      all_available_permissions: ["/key/generate", "/key/list"],
      team_member_permissions: ["/key/generate"],
    });

    renderWithProviders(<MemberPermissions teamId="team-123" accessToken="token-123" canEditTeam={false} />);

    await waitFor(() => {
      expect(screen.getByText("成员权限")).toBeInTheDocument();
    });

    expect(checkboxFor("/key/list")).not.toBeChecked();

    await act(async () => {
      fireEvent.click(checkboxFor("/key/list"));
    });

    expect(checkboxFor("/key/list")).not.toBeChecked();
    expect(screen.queryByRole("button", { name: "保存更改" })).not.toBeInTheDocument();
  });

  it("should handle reset button click", async () => {
    vi.mocked(networking.getTeamPermissionsCall).mockResolvedValue({
      all_available_permissions: ["/key/generate", "/key/list"],
      team_member_permissions: ["/key/generate"],
    });

    renderWithProviders(<MemberPermissions teamId="team-123" accessToken="token-123" canEditTeam={true} />);

    await waitFor(() => {
      expect(screen.getByText("成员权限")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(checkboxFor("/key/list"));
    });

    expect(checkboxFor("/key/list")).toBeChecked();

    vi.mocked(networking.getTeamPermissionsCall).mockResolvedValueOnce({
      all_available_permissions: ["/key/generate", "/key/list"],
      team_member_permissions: ["/key/generate"],
    });

    const resetButton = await screen.findByRole("button", { name: "重置" });
    await act(async () => {
      fireEvent.click(resetButton);
    });

    await waitFor(() => {
      expect(networking.getTeamPermissionsCall).toHaveBeenCalledTimes(2);
    });

    expect(checkboxFor("/key/list")).not.toBeChecked();
    expect(screen.queryByRole("button", { name: "保存更改" })).not.toBeInTheDocument();
  });
});
