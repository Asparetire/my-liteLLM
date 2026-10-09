"use client";

import { MCPServer } from "@/components/mcp_tools/types";

export interface RequiredFieldDef {
  key: string;
  labelKey: string;
  descriptionKey: string;
  check: (server: MCPServer) => boolean;
}

export interface FieldGroup {
  labelKey: string;
  fields: RequiredFieldDef[];
}

export const FIELD_GROUPS: FieldGroup[] = [
  {
    labelKey: "standardsGroupDocumentation",
    fields: [
      {
        key: "description",
        labelKey: "standardsFieldDescriptionLabel",
        descriptionKey: "standardsFieldDescriptionDesc",
        check: (s) => !!s.description?.trim(),
      },
      {
        key: "alias",
        labelKey: "standardsFieldAliasLabel",
        descriptionKey: "standardsFieldAliasDesc",
        check: (s) => !!s.alias?.trim(),
      },
    ],
  },
  {
    labelKey: "standardsGroupSource",
    fields: [
      {
        key: "source_url",
        labelKey: "standardsFieldSourceUrlLabel",
        descriptionKey: "standardsFieldSourceUrlDesc",
        check: (s) => !!s.source_url?.trim(),
      },
    ],
  },
  {
    labelKey: "standardsGroupConnection",
    fields: [
      {
        key: "url",
        labelKey: "standardsFieldUrlLabel",
        descriptionKey: "standardsFieldUrlDesc",
        check: (s) => !!s.url?.trim(),
      },
    ],
  },
  {
    labelKey: "standardsGroupSecurity",
    fields: [
      {
        key: "auth_type",
        labelKey: "standardsFieldAuthLabel",
        descriptionKey: "standardsFieldAuthDesc",
        check: (s) => !!s.auth_type && s.auth_type !== "none",
      },
    ],
  },
];

export const MCP_REQUIRED_FIELD_DEFS: RequiredFieldDef[] = FIELD_GROUPS.flatMap((g) => g.fields);

export const SETTINGS_KEY = "mcp_required_fields";
