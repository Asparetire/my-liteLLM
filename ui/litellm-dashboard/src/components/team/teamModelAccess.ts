export const ALL_PROXY_MODELS = "all-proxy-models";
export const NO_DEFAULT_MODELS = "no-default-models";

export interface TeamAccessGroupModelGrant {
  access_group_id: string;
  access_group_name: string;
  models: string[];
  mcp_server_ids?: string[];
  agent_ids?: string[];
}

export type TeamModelBadgeKind = "all-proxy" | "no-default" | "direct" | "access-group";

export interface TeamModelBadge {
  label: string;
  kind: TeamModelBadgeKind;
  tooltip: string;
}

export function normalizeTeamModelSelection(models: string[] | undefined): string[] {
  return models && models.length > 0 ? models : [NO_DEFAULT_MODELS];
}

export const describeGroups = (names: string[]): string =>
  names.length > 1 ? `access groups ${names.join(", ")}` : `access group ${names[0]}`;

/**
 * User-facing badge strings for computeTeamModelBadges. Callers pass a
 * translated set (see teamInfo namespace); defaults keep the module
 * usable without a component context.
 */
export interface TeamModelBadgeMessages {
  allProxyModels: string;
  allProxyFromEntry: string;
  allProxyEmptyList: string;
  noDefaultModels: string;
  noDefaultTooltip: string;
  grantedDirect: string;
  grantedDirectAndVia: (groups: string) => string;
  grantedVia: (groups: string) => string;
  viaAccessGroup: (name: string) => string;
  viaAccessGroups: (names: string) => string;
  viaUnknownGroup: string;
}

const DEFAULT_BADGE_MESSAGES: TeamModelBadgeMessages = {
  allProxyModels: "All proxy models",
  allProxyFromEntry: "Granted by the All Proxy Models entry in the team's model list",
  allProxyEmptyList: "The team's model list is empty, so it can access every model on the proxy",
  noDefaultModels: "No default models",
  noDefaultTooltip: "No models are granted directly. Access comes only from access groups",
  grantedDirect: "Granted directly in the team's model list",
  grantedDirectAndVia: (groups) => `Granted directly in the team's model list, and also via ${groups}`,
  grantedVia: (groups) => `Granted via ${groups}`,
  viaAccessGroup: (name) => `access group ${name}`,
  viaAccessGroups: (names) => `access groups ${names}`,
  viaUnknownGroup: "an access group",
};

export function computeTeamModelBadges(
  models: string[],
  accessGroupModels: string[],
  accessGroupDetails: TeamAccessGroupModelGrant[] | undefined,
  messages: TeamModelBadgeMessages = DEFAULT_BADGE_MESSAGES,
): TeamModelBadge[] {
  const m = messages;
  const grants = accessGroupDetails ?? [];
  const groupNamesFor = (model: string): string[] =>
    grants.filter((g) => g.models.includes(model)).map((g) => g.access_group_name);
  const viaGroups = (model: string): string => {
    const names = groupNamesFor(model);
    if (names.length === 0) return m.viaUnknownGroup;
    return names.length > 1 ? m.viaAccessGroups(names.join(", ")) : m.viaAccessGroup(names[0]);
  };

  const allProxy = models.length === 0 || models.includes(ALL_PROXY_MODELS);
  const directModels = allProxy ? [] : models.filter((m) => m !== NO_DEFAULT_MODELS);
  const groupModels = [...new Set(grants.length > 0 ? grants.flatMap((g) => g.models) : accessGroupModels)].filter(
    (model) => !directModels.includes(model),
  );

  const allProxyBadge: TeamModelBadge = {
    label: m.allProxyModels,
    kind: "all-proxy",
    tooltip: models.includes(ALL_PROXY_MODELS) ? m.allProxyFromEntry : m.allProxyEmptyList,
  };
  const noDefaultBadge: TeamModelBadge = {
    label: m.noDefaultModels,
    kind: "no-default",
    tooltip: m.noDefaultTooltip,
  };
  const headBadge = (): TeamModelBadge[] => {
    if (allProxy) return [allProxyBadge];
    if (models.includes(NO_DEFAULT_MODELS)) return [noDefaultBadge];
    return [];
  };

  return [
    ...headBadge(),
    ...directModels.map(
      (model): TeamModelBadge => ({
        label: model,
        kind: "direct",
        tooltip: groupNamesFor(model).length > 0 ? m.grantedDirectAndVia(viaGroups(model)) : m.grantedDirect,
      }),
    ),
    ...groupModels.map(
      (model): TeamModelBadge => ({
        label: model,
        kind: "access-group",
        tooltip: m.grantedVia(viaGroups(model)),
      }),
    ),
  ];
}
