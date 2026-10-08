export type CoordinationFieldType = "string" | "password" | "integer" | "boolean" | "list";

export type CoordinationRedisType = "node" | "cluster" | "sentinel";

export type CoordinationSection = "connection" | "cluster" | "sentinel" | "ssl";

export type CoordinationFieldRule = (value: unknown) => string | null;

export interface CoordinationField {
  readonly name: string;
  readonly label: string;
  readonly type: CoordinationFieldType;
  readonly section: CoordinationSection;
  readonly helpText: string;
  readonly redisType: CoordinationRedisType | null;
  readonly secret: boolean;
  readonly defaultValue?: string | number | boolean;
  readonly rules?: CoordinationFieldRule[];
}

export const COORDINATION_REDIS_TYPES: readonly CoordinationRedisType[] = ["node", "cluster", "sentinel"];

export const COORDINATION_REDIS_TYPE_DESCRIPTIONS: Readonly<Record<CoordinationRedisType, string>> = {
  node: "redisTypeNodeDesc",
  cluster: "redisTypeClusterDesc",
  sentinel: "redisTypeSentinelDesc",
};

export const COORDINATION_REDIS_TYPE_LABELS: Readonly<Record<CoordinationRedisType, string>> = {
  node: "redisTypeNode",
  cluster: "redisTypeCluster",
  sentinel: "redisTypeSentinel",
};

const isBlank = (value: unknown): boolean => value === undefined || value === null || String(value).trim() === "";

const portRule: CoordinationFieldRule = (value) => {
  if (isBlank(value)) {
    return null;
  }
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? null : "rulePortRange";
};

const jsonListRule: CoordinationFieldRule = (value) => {
  if (isBlank(value)) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(value));
  } catch {
    return "ruleJsonArray";
  }
  return Array.isArray(parsed) ? null : "ruleJsonArrayType";
};

export const COORDINATION_FIELDS: readonly CoordinationField[] = [
  {
    name: "url",
    label: "fieldUrl",
    type: "password",
    section: "connection",
    helpText: "coordFieldUrlHelp",
    redisType: null,
    secret: true,
  },
  {
    name: "host",
    label: "fieldHost",
    type: "string",
    section: "connection",
    helpText: "fieldHostHelp",
    redisType: null,
    secret: false,
  },
  {
    name: "port",
    label: "fieldPort",
    type: "integer",
    section: "connection",
    helpText: "fieldPortHelp",
    redisType: null,
    secret: false,
    defaultValue: "6379",
    rules: [portRule],
  },
  {
    name: "username",
    label: "fieldUsername",
    type: "string",
    section: "connection",
    helpText: "fieldUsernameHelp",
    redisType: null,
    secret: false,
  },
  {
    name: "password",
    label: "fieldPassword",
    type: "password",
    section: "connection",
    helpText: "fieldPasswordHelp",
    redisType: null,
    secret: true,
  },
  {
    name: "startup_nodes",
    label: "fieldStartupNodes",
    type: "list",
    section: "cluster",
    helpText: "coordFieldStartupNodesHelp",
    redisType: "cluster",
    secret: false,
    rules: [jsonListRule],
  },
  {
    name: "sentinel_nodes",
    label: "fieldSentinelNodes",
    type: "list",
    section: "sentinel",
    helpText: "fieldSentinelNodesHelp",
    redisType: "sentinel",
    secret: false,
    rules: [jsonListRule],
  },
  {
    name: "service_name",
    label: "fieldServiceName",
    type: "string",
    section: "sentinel",
    helpText: "fieldServiceNameHelp",
    redisType: "sentinel",
    secret: false,
  },
  {
    name: "sentinel_password",
    label: "fieldSentinelPassword",
    type: "password",
    section: "sentinel",
    helpText: "fieldSentinelPasswordHelp",
    redisType: "sentinel",
    secret: true,
  },
  {
    name: "ssl",
    label: "fieldSsl",
    type: "boolean",
    section: "ssl",
    helpText: "fieldSslHelp",
    redisType: null,
    secret: false,
    defaultValue: false,
  },
];
