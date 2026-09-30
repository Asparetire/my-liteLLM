// 错误码选项：labelKey 指向 logs 命名空间的键，渲染处用 t() 解析；value 是 API 数据值不译
export const ERROR_CODE_OPTIONS: { labelKey: string; value: string }[] = [
  { labelKey: "errorCode400", value: "400" },
  { labelKey: "errorCode401", value: "401" },
  { labelKey: "errorCode403", value: "403" },
  { labelKey: "errorCode404", value: "404" },
  { labelKey: "errorCode408", value: "408" },
  { labelKey: "errorCode422", value: "422" },
  { labelKey: "errorCode429", value: "429" },
  { labelKey: "errorCode500", value: "500" },
  { labelKey: "errorCode502", value: "502" },
  { labelKey: "errorCode503", value: "503" },
  { labelKey: "errorCode529", value: "529" },
];

/** Call types that represent MCP tool invocations (shared across columns, index, drawer). */
export const MCP_CALL_TYPES = ["call_mcp_tool", "list_mcp_tools"];

/** Call types that represent agent/A2A requests (e.g. asend_message). */
export const AGENT_CALL_TYPES = ["asend_message"];

/** Call types that represent Batch API operations (creation and retrieval, sync and async). */
export const BATCH_CALL_TYPES = ["acreate_batch", "create_batch", "aretrieve_batch", "retrieve_batch"];

// 快捷时间范围：labelKey 指向 logs 命名空间；unit 是 moment 时间单位数据值不译
export const QUICK_SELECT_OPTIONS: { labelKey: string; value: number; unit: string }[] = [
  { labelKey: "lastMinute", value: 1, unit: "minutes" },
  { labelKey: "last15Minutes", value: 15, unit: "minutes" },
  { labelKey: "lastHour", value: 1, unit: "hours" },
  { labelKey: "last4Hours", value: 4, unit: "hours" },
  { labelKey: "last24Hours", value: 24, unit: "hours" },
  { labelKey: "last7Days", value: 7, unit: "days" },
];
