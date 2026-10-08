export type CacheFieldType =
  | "string"
  | "password"
  | "integer"
  | "float"
  | "boolean"
  | "list"
  | "model-select"
  | "select";

export interface CacheFieldOption {
  readonly value: string;
  readonly label: string;
}

export type RedisType = "node" | "cluster" | "sentinel" | "semantic";

export type CacheSection = "connection" | "cluster" | "sentinel" | "semantic" | "ssl" | "cacheManagement" | "gcp";

export type CacheFieldRule = (value: unknown) => string | null;

// Marker the backend returns for a configured credential and maps back to the
// stored secret on save, so the plaintext never round-trips through the form.
export const REDACTED_VALUE = "***REDACTED***";

export interface CacheField {
  readonly name: string;
  readonly label: string;
  readonly type: CacheFieldType;
  readonly section: CacheSection;
  readonly helpText: string;
  readonly redisType: RedisType | null;
  readonly defaultValue?: string | number | boolean;
  readonly options?: readonly CacheFieldOption[];
  readonly rules?: CacheFieldRule[];
  // Credential field: never prefilled into the form, and dropped from the save
  // payload when left untouched so the redacted marker is never persisted.
  readonly secret?: boolean;
}

export const REDIS_TYPES: readonly RedisType[] = ["node", "cluster", "sentinel", "semantic"];

export const REDIS_TYPE_DESCRIPTIONS: Readonly<Record<RedisType, string>> = {
  node: "redisTypeNodeDesc",
  cluster: "redisTypeClusterDesc",
  sentinel: "redisTypeSentinelDesc",
  semantic: "redisTypeSemanticDesc",
};

const isBlank = (value: unknown): boolean => value === undefined || value === null || String(value).trim() === "";

const portRule: CacheFieldRule = (value) => {
  if (isBlank(value)) {
    return null;
  }
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? null : "rulePortRange";
};

const jsonListRule: CacheFieldRule = (value) => {
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

const nonNegativeIntegerRule: CacheFieldRule = (value) => {
  if (isBlank(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? null : "ruleNonNegativeInt";
};

const numberRule: CacheFieldRule = (value) => {
  if (isBlank(value)) {
    return null;
  }
  return Number.isNaN(Number(value)) ? "ruleNumber" : null;
};

export const CACHE_FIELDS: readonly CacheField[] = [
  {
    name: "url",
    label: "fieldUrl",
    type: "string",
    section: "connection",
    helpText: "fieldUrlHelp",
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
  },
  {
    name: "port",
    label: "fieldPort",
    type: "string",
    section: "connection",
    helpText: "fieldPortHelp",
    redisType: null,
    defaultValue: "6379",
    rules: [portRule],
  },
  {
    name: "db",
    label: "fieldDb",
    type: "integer",
    section: "connection",
    helpText: "fieldDbHelp",
    redisType: null,
    rules: [nonNegativeIntegerRule],
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
    name: "username",
    label: "fieldUsername",
    type: "string",
    section: "connection",
    helpText: "fieldUsernameHelp",
    redisType: null,
  },
  {
    name: "redis_startup_nodes",
    label: "fieldStartupNodes",
    type: "list",
    section: "cluster",
    helpText: "fieldStartupNodesHelp",
    redisType: "cluster",
    rules: [jsonListRule],
  },
  {
    name: "sentinel_nodes",
    label: "fieldSentinelNodes",
    type: "list",
    section: "sentinel",
    helpText: "fieldSentinelNodesHelp",
    redisType: "sentinel",
    rules: [jsonListRule],
  },
  {
    name: "service_name",
    label: "fieldServiceName",
    type: "string",
    section: "sentinel",
    helpText: "fieldServiceNameHelp",
    redisType: "sentinel",
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
    name: "similarity_threshold",
    label: "fieldSimilarityThreshold",
    type: "float",
    section: "semantic",
    helpText: "fieldSimilarityThresholdHelp",
    redisType: "semantic",
    defaultValue: 0.8,
    rules: [numberRule],
  },
  {
    name: "redis_semantic_cache_embedding_model",
    label: "fieldEmbeddingModel",
    type: "model-select",
    section: "semantic",
    helpText: "fieldEmbeddingModelHelp",
    redisType: "semantic",
  },
  {
    name: "semantic_cache_scope",
    label: "fieldSemanticScope",
    type: "select",
    section: "semantic",
    helpText: "fieldSemanticScopeHelp",
    redisType: "semantic",
    defaultValue: "key",
    options: [
      { value: "key", label: "optionScopeKey" },
      { value: "end_user", label: "optionScopeEndUser" },
    ],
  },
  {
    name: "ssl",
    label: "fieldSsl",
    type: "boolean",
    section: "ssl",
    helpText: "fieldSslHelp",
    redisType: null,
    defaultValue: false,
  },
  {
    name: "ssl_cert_reqs",
    label: "fieldSslCertReqs",
    type: "string",
    section: "ssl",
    helpText: "fieldSslCertReqsHelp",
    redisType: null,
  },
  {
    name: "ssl_check_hostname",
    label: "fieldSslCheckHostname",
    type: "boolean",
    section: "ssl",
    helpText: "fieldSslCheckHostnameHelp",
    redisType: null,
    defaultValue: false,
  },
  {
    name: "namespace",
    label: "fieldNamespace",
    type: "string",
    section: "cacheManagement",
    helpText: "fieldNamespaceHelp",
    redisType: null,
  },
  {
    name: "ttl",
    label: "fieldTtl",
    type: "float",
    section: "cacheManagement",
    helpText: "fieldTtlHelp",
    redisType: null,
    rules: [numberRule],
  },
  {
    name: "max_connections",
    label: "fieldMaxConnections",
    type: "integer",
    section: "cacheManagement",
    helpText: "fieldMaxConnectionsHelp",
    redisType: null,
    rules: [nonNegativeIntegerRule],
  },
  {
    name: "gcp_service_account",
    label: "fieldGcpServiceAccount",
    type: "string",
    section: "gcp",
    helpText: "fieldGcpServiceAccountHelp",
    redisType: null,
  },
  {
    name: "gcp_ssl_ca_certs",
    label: "fieldGcpSslCaCerts",
    type: "string",
    section: "gcp",
    helpText: "fieldGcpSslCaCertsHelp",
    redisType: null,
  },
];
