import { Info } from "lucide-react";
import React from "react";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SimpleTooltip } from "@/components/ui/tooltip";

import { MountedFormField } from "@/components/common_components/MountedFormField";
import { selectControl, selectTriggerControl } from "./mcpFieldRules";

const TOKEN_ENDPOINT_AUTH_METHOD_OPTIONS = [
  { value: "client_secret_basic", label: "Client Secret Basic" },
  { value: "client_secret_post", label: "Client Secret Post" },
];

interface TokenEndpointAuthMethodFieldProps {
  isEditing?: boolean;
}

const TokenEndpointAuthMethodField: React.FC<TokenEndpointAuthMethodFieldProps> = ({ isEditing = false }) => {
  const t = useTranslations("mcpServers");
  return (
    <MountedFormField
      label={
        <span className="text-sm font-medium text-foreground flex items-center">
          {t("tokenEndpointAuthMethodLabel")}
          <SimpleTooltip content={t("tokenEndpointAuthMethodTooltip")}>
            <Info className="ml-2 size-4 text-info hover:text-info/80 cursor-help" />
          </SimpleTooltip>
        </span>
      }
      name={["credentials", "token_endpoint_auth_method"]}
    >
      {(control) => {
        const placeholder = isEditing
          ? t("tokenEndpointPlaceholderEdit")
          : t("tokenEndpointPlaceholderCreate");
        return (
          <Select {...selectControl<string>(control)} items={TOKEN_ENDPOINT_AUTH_METHOD_OPTIONS}>
            <SelectTrigger {...selectTriggerControl(control)} className="w-full rounded-lg">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>{placeholder}</SelectItem>
              {TOKEN_ENDPOINT_AUTH_METHOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }}
    </MountedFormField>
  );
};

export default TokenEndpointAuthMethodField;
