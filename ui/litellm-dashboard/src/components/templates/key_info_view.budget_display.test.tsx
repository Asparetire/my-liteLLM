import { renderWithProviders } from "../../../tests/test-utils";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KeyResponse, Team } from "../key_team_helpers/key_list";
import KeyInfoView from "./key_info_view";
import useAuthorized from "@/app/(dashboard)/hooks/useAuthorized";
import useTeams from "@/app/(dashboard)/hooks/useTeams";
import { useOrganizations } from "@/app/(dashboard)/hooks/organizations/useOrganizations";
import type { Organization } from "../networking";

// IMPORTANT: do not mock `@/utils/dataUtils` here. We want to exercise the
// real `formatNumberWithCommas`/`getSpendString` so this test catches the
// LIT-2845 class of regression where the overview "Spend" card formats a
// value with the wrong precision, truncating sub-1-token spend to "0 tokens".

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("./key_edit_view", () => ({
  KeyEditView: () => <div data-testid="key-edit-view-stub" />,
}));

vi.mock("@/app/(dashboard)/hooks/useTeams", () => ({ default: vi.fn() }));
vi.mock("@/app/(dashboard)/hooks/organizations/useOrganizations", () => ({ useOrganizations: vi.fn() }));
vi.mock("@/app/(dashboard)/hooks/useAuthorized", () => ({ default: vi.fn() }));
vi.mock("@/app/(dashboard)/hooks/projects/useProjects", () => ({
  useProjects: vi.fn().mockReturnValue({ data: [], isLoading: false }),
}));
vi.mock("@/app/(dashboard)/hooks/keys/useResetKeySpend", () => ({
  useResetKeySpend: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));
vi.mock("../networking", () => ({
  serverRootPath: "",
  keyDeleteCall: vi.fn().mockResolvedValue({}),
  keyUpdateCall: vi.fn().mockResolvedValue({}),
  getPolicyInfoWithGuardrails: vi.fn().mockResolvedValue({ resolved_guardrails: [] }),
}));

const MOCK_KEY_DATA = {
  token: "test-token-123",
  token_id: "test-token-123",
  key_name: "sk-...abcd",
  key_alias: "lit-2845-budget-display",
  spend: 0.0001,
  max_budget: null as number | null,
  expires: "null",
  models: [],
  aliases: {},
  config: {},
  user_id: "default_user_id",
  team_id: null,
  max_parallel_requests: null,
  metadata: {},
  tpm_limit: null,
  rpm_limit: null,
  budget_duration: null,
  budget_reset_at: null,
  allowed_cache_controls: [],
  permissions: {},
  model_spend: {},
  model_max_budget: {},
  soft_budget_cooldown: false,
  blocked: false,
  litellm_budget_table: {},
  organization_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  team_spend: 0,
  team_alias: "",
  team_tpm_limit: null,
  team_rpm_limit: null,
  team_max_budget: null,
  team_models: [],
  team_blocked: false,
  soft_budget: null,
  team_model_aliases: {},
  team_member_spend: 0,
  team_metadata: {},
  end_user_id: null,
  end_user_tpm_limit: null,
  end_user_rpm_limit: null,
  end_user_max_budget: null,
  last_refreshed_at: 0,
  api_key: "sk-...abcd",
  user_role: "user",
  rpm_limit_per_model: {},
  tpm_limit_per_model: {},
  user_tpm_limit: null,
  user_rpm_limit: null,
  user_email: "test@example.com",
  object_permission: {
    object_permission_id: "perm-1",
    mcp_servers: [],
    mcp_access_groups: [],
    mcp_tool_permissions: {},
    vector_stores: [],
  },
  auto_rotate: false,
  rotation_interval: undefined,
  last_rotation_at: undefined,
  key_rotation_at: undefined,
} as unknown as KeyResponse;

const baseAuthorized = {
  accessToken: "test-token",
  userId: "test-user",
  userRole: "admin",
  premiumUser: true,
  token: "test-token",
  userEmail: null,
  disabledPersonalKeyCreation: null,
  showSSOBanner: false,
  isLoading: false,
  isAuthorized: true,
};

const makeTeam = (overrides: Partial<Team>): Team => ({
  team_id: "team-default",
  team_alias: "Default Team",
  models: [],
  max_budget: null,
  budget_duration: null,
  tpm_limit: null,
  rpm_limit: null,
  organization_id: "",
  created_at: "2026-01-01T00:00:00Z",
  keys: [],
  members_with_roles: [],
  spend: 0,
  ...overrides,
});

const makeOrganization = (overrides: Partial<Organization>): Organization =>
  ({
    organization_id: "org-1",
    organization_alias: "Acme Org",
    budget_id: "budget-1",
    metadata: {},
    models: [],
    spend: 0,
    model_spend: {},
    created_at: "2026-01-01T00:00:00Z",
    created_by: "admin",
    updated_at: "2026-01-01T00:00:00Z",
    updated_by: "admin",
    litellm_budget_table: { max_budget: null, budget_duration: null },
    teams: null,
    users: null,
    members: null,
    ...overrides,
  }) as Organization;

const mockOrganizations = (organizations: Organization[]) =>
  vi.mocked(useOrganizations).mockReturnValue({ data: organizations } as ReturnType<typeof useOrganizations>);

describe("KeyInfoView overview budget display (LIT-2845)", () => {
  beforeEach(() => {
    vi.mocked(useTeams).mockReturnValue({ teams: [], setTeams: vi.fn() });
    vi.mocked(useAuthorized).mockReturnValue(baseAuthorized);
    mockOrganizations([]);
  });

  it("renders a fractional max_budget (0.1) as whole tokens in the overview Spend card", async () => {
    renderWithProviders(
      <KeyInfoView
        keyData={{ ...MOCK_KEY_DATA, max_budget: 0.1 }}
        onClose={() => {}}
        keyId={"test-key-id"}
        onKeyDataUpdate={() => {}}
        teams={[]}
      />,
    );

    // Budgets are token counts now, so a fractional budget renders as the
    // rounded whole-token count followed by "tokens".
    await waitFor(() => {
      expect(screen.getByText(/of 0 tokens/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/of \$/)).not.toBeInTheDocument();
  });

  it("still renders a whole-number max_budget with thousands separators", async () => {
    renderWithProviders(
      <KeyInfoView
        keyData={{ ...MOCK_KEY_DATA, max_budget: 100 }}
        onClose={() => {}}
        keyId={"test-key-id"}
        onKeyDataUpdate={() => {}}
        teams={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/of 100 tokens/)).toBeInTheDocument();
    });
  });

  it("renders spend in token semantics: '< 1 token' for 0.0001 and '0 tokens' for zero", async () => {
    renderWithProviders(
      <KeyInfoView
        keyData={MOCK_KEY_DATA}
        onClose={() => {}}
        keyId={"test-key-id"}
        onKeyDataUpdate={() => {}}
        teams={[]}
      />,
    );
    // Regression for the token-semantics migration: sub-1-token spend must
    // not be truncated to "0 tokens"; zero spend must read "0 tokens",
    // not the "-" that getSpendString returns for 0. The value renders both
    // in the Overview card and the keep-mounted Settings tab.
    await waitFor(() => {
      expect(screen.getAllByText("< 1 token").length).toBeGreaterThan(0);
    });
  });

  it("renders exactly-zero spend as '0 tokens' in the overview Spend card", async () => {
    renderWithProviders(
      <KeyInfoView
        keyData={{ ...MOCK_KEY_DATA, spend: 0 }}
        onClose={() => {}}
        keyId={"test-key-id"}
        onKeyDataUpdate={() => {}}
        teams={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.getAllByText("0 tokens").length).toBeGreaterThan(0);
    });
  });

  it("renders 'Unlimited' when max_budget is null", async () => {
    renderWithProviders(
      <KeyInfoView
        keyData={{ ...MOCK_KEY_DATA, max_budget: null } as unknown as KeyResponse}
        onClose={() => {}}
        keyId={"test-key-id"}
        onKeyDataUpdate={() => {}}
        teams={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/of Unlimited/)).toBeInTheDocument();
    });
  });

  it("never pairs key spend with the team budget: shows Unlimited plus an inherited-budget hint", async () => {
    vi.mocked(useTeams).mockReturnValue({
      teams: [makeTeam({ team_id: "team-123", team_alias: "Test Budget", max_budget: 1200, budget_duration: "30d" })],
      setTeams: vi.fn(),
    });
    renderWithProviders(
      <KeyInfoView
        keyData={{ ...MOCK_KEY_DATA, max_budget: null, team_id: "team-123" } as unknown as KeyResponse}
        onClose={() => {}}
        keyId={"test-key-id"}
        onKeyDataUpdate={() => {}}
        teams={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/of Unlimited/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/of 1,200 tokens/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\(Team: Test Budget/)).not.toBeInTheDocument();
    await userEvent.setup().hover(screen.getByLabelText("question-circle"));
    expect(screen.getByTestId("inherited-budget-hint")).toHaveTextContent("Team Test Budget: 1,200 tokens / 30d");
  });

  it("lists the organization budget in the hint when the team's org has one", async () => {
    vi.mocked(useTeams).mockReturnValue({
      teams: [makeTeam({ team_id: "team-456", team_alias: "Org Team", organization_id: "org-1" })],
      setTeams: vi.fn(),
    });
    mockOrganizations([makeOrganization({ litellm_budget_table: { max_budget: 5000, budget_duration: null } })]);
    renderWithProviders(
      <KeyInfoView
        keyData={{ ...MOCK_KEY_DATA, max_budget: null, team_id: "team-456" } as unknown as KeyResponse}
        onClose={() => {}}
        keyId={"test-key-id"}
        onKeyDataUpdate={() => {}}
        teams={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/of Unlimited/)).toBeInTheDocument();
    });
    await userEvent.setup().hover(screen.getByLabelText("question-circle"));
    expect(screen.getByTestId("inherited-budget-hint")).toHaveTextContent("Organization Acme Org: 5,000 tokens");
    expect(screen.getByTestId("inherited-budget-hint")).not.toHaveTextContent("Team Org Team");
  });

  it("renders 'Unlimited' with no hint when neither key, team, nor org has a budget", async () => {
    vi.mocked(useTeams).mockReturnValue({
      teams: [makeTeam({ team_id: "team-789", team_alias: "Free Team" })],
      setTeams: vi.fn(),
    });
    renderWithProviders(
      <KeyInfoView
        keyData={{ ...MOCK_KEY_DATA, max_budget: null, team_id: "team-789" } as unknown as KeyResponse}
        onClose={() => {}}
        keyId={"test-key-id"}
        onKeyDataUpdate={() => {}}
        teams={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/of Unlimited/)).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("question-circle")).not.toBeInTheDocument();
  });

  it("shows no hint when the key has its own budget even if the team has one", async () => {
    vi.mocked(useTeams).mockReturnValue({
      teams: [makeTeam({ team_id: "team-123", team_alias: "Test Budget", max_budget: 1200 })],
      setTeams: vi.fn(),
    });
    renderWithProviders(
      <KeyInfoView
        keyData={{ ...MOCK_KEY_DATA, max_budget: 25, team_id: "team-123" } as unknown as KeyResponse}
        onClose={() => {}}
        keyId={"test-key-id"}
        onKeyDataUpdate={() => {}}
        teams={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/of 25 tokens/)).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("question-circle")).not.toBeInTheDocument();
  });
});

describe("KeyInfoView budget reset visibility", () => {
  beforeEach(() => {
    vi.mocked(useTeams).mockReturnValue({ teams: [], setTeams: vi.fn() });
    vi.mocked(useAuthorized).mockReturnValue(baseAuthorized);
    mockOrganizations([]);
  });

  const KEY_WITH_RESET = {
    ...MOCK_KEY_DATA,
    max_budget: 0.1,
    budget_duration: "1d",
    budget_reset_at: "2026-07-22T12:00:00+00:00",
  } as unknown as KeyResponse;

  it("shows the next budget reset in the overview Spend card when budget_reset_at is set", async () => {
    renderWithProviders(
      <KeyInfoView
        keyData={KEY_WITH_RESET}
        onClose={() => {}}
        keyId={"test-key-id"}
        onKeyDataUpdate={() => {}}
        teams={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/^Resets Jul 22, 2026/)).toBeInTheDocument();
    });
  });

  it("omits the reset line from the overview Spend card when budget_reset_at is null", async () => {
    renderWithProviders(
      <KeyInfoView
        keyData={{ ...MOCK_KEY_DATA, max_budget: 0.1 } as unknown as KeyResponse}
        onClose={() => {}}
        keyId={"test-key-id"}
        onKeyDataUpdate={() => {}}
        teams={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/of 0 tokens/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/^Resets /)).not.toBeInTheDocument();
  });

  it("shows the duration and next reset in the Settings tab", async () => {
    renderWithProviders(
      <KeyInfoView
        keyData={KEY_WITH_RESET}
        onClose={() => {}}
        keyId={"test-key-id"}
        onKeyDataUpdate={() => {}}
        teams={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Settings" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("tab", { name: "Settings" }));
    await waitFor(() => {
      expect(screen.getByText("Budget Reset")).toBeInTheDocument();
    });
    expect(screen.getByText(/Every 1d, next Jul 22, 2026/)).toBeInTheDocument();
  });

  it("shows 'Never' in the Settings tab when no reset is scheduled", async () => {
    renderWithProviders(
      <KeyInfoView
        keyData={MOCK_KEY_DATA}
        onClose={() => {}}
        keyId={"test-key-id"}
        onKeyDataUpdate={() => {}}
        teams={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Settings" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("tab", { name: "Settings" }));
    await waitFor(() => {
      expect(screen.getByText("Budget Reset")).toBeInTheDocument();
    });
    expect(screen.getByTestId("budget-reset-value")).toHaveTextContent("Never");
  });
});
