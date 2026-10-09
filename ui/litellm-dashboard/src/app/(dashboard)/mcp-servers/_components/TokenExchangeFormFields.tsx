import { Info } from "lucide-react";
import React from "react";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { useWatch } from "react-hook-form";

import { MountedFormField } from "@/components/common_components/MountedFormField";
import UpstreamTokenHeaderField from "./UpstreamTokenHeaderField";
import { requiredRule } from "@/components/common_components/formRules";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { Input } from "@/components/ui/input";
import { selectControl, selectTriggerControl, tagsControl, textControl } from "./mcpFieldRules";

interface TokenExchangeFormFieldsProps {
  isEditing?: boolean;
}

const fieldClassName = "rounded-lg border-border focus:border-info focus:ring-ring";

const TOKEN_EXCHANGE_PROFILE_ITEMS = [
  { value: "rfc8693", label: "RFC 8693 (standard)" },
  { value: "entra_obo", label: "Microsoft Entra OBO" },
];

const FieldLabel: React.FC<{ label: string; tooltip: string }> = ({ label, tooltip }) => (
  <span className="text-sm font-medium text-foreground flex items-center">
    {label}
    <SimpleTooltip content={tooltip}>
      <Info className="ml-2 size-4 text-info hover:text-info/80 cursor-help" />
    </SimpleTooltip>
  </span>
);

const TokenExchangeFormFields: React.FC<TokenExchangeFormFieldsProps> = ({ isEditing = false }) => {
  const t = useTranslations("mcpServers");
  const placeholderSuffix = isEditing ? t("oauthKeepExistingSuffix") : "";
  const isEntraObo = useWatch({ name: "token_exchange_profile" }) === "entra_obo";
  const requiredWhenCreating = (message: string) =>
    isEditing ? undefined : { validate: { required: requiredRule(message) } };
  const scopesLabel = isEntraObo ? t("teScopesRequiredLabel") : t("teScopesLabel");
  const scopesTooltip = isEntraObo ? t("teEntraScopesTooltip") : t("teScopesOptionalTooltip");
  const scopesPlaceholder = isEntraObo ? "api://<app-id>/.default" : t("oauthScopesPlaceholder");
  const scopesRules = isEntraObo
    ? {
        validate: {
          required: requiredRule(t("teEntraScopeRequired")),
        },
      }
    : undefined;

  return (
    <>
      <MountedFormField
        label={
          <FieldLabel label={t("teProfileLabel")} tooltip={t("teProfileTooltip")} />
        }
        name="token_exchange_profile"
        {...(isEditing ? {} : { defaultValue: "rfc8693" })}
      >
        {(control) => (
          <Select {...selectControl<string>(control)} items={TOKEN_EXCHANGE_PROFILE_ITEMS}>
            <SelectTrigger {...selectTriggerControl(control)} className="w-full rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOKEN_EXCHANGE_PROFILE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  <span className="font-medium">{item.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </MountedFormField>
      <MountedFormField
        label={
          <FieldLabel label={t("teEndpointLabel")} tooltip={t("teEndpointTooltip")} />
        }
        name="token_exchange_endpoint"
      >
        {(control) => (
          <Input
            {...textControl(control)}
            placeholder="https://idp.example.com/oauth2/token"
            className={fieldClassName}
          />
        )}
      </MountedFormField>
      <MountedFormField
        label={
          <FieldLabel label="Client ID" tooltip={t("teClientIdTooltip")} />
        }
        name={["credentials", "client_id"]}
        required={!isEditing}
        rules={requiredWhenCreating(t("teClientIdRequired"))}
      >
        {(control) => (
          <PasswordInput
            {...textControl(control)}
            placeholder={t("oauthClientIdPlaceholder", { suffix: placeholderSuffix })}
            groupClassName={fieldClassName}
          />
        )}
      </MountedFormField>
      <MountedFormField
        label={
          <FieldLabel
            label="Client Secret"
            tooltip={t("teClientSecretTooltip")}
          />
        }
        name={["credentials", "client_secret"]}
        required={!isEditing}
        rules={requiredWhenCreating(t("teClientSecretRequired"))}
      >
        {(control) => (
          <PasswordInput
            {...textControl(control)}
            placeholder={t("oauthClientSecretPlaceholder", { suffix: placeholderSuffix })}
            groupClassName={fieldClassName}
          />
        )}
      </MountedFormField>
      {!isEntraObo && (
        <>
          <MountedFormField
            label={
              <FieldLabel label={t("teAudienceLabel")} tooltip={t("teAudienceTooltip")} />
            }
            name="audience"
          >
            {(control) => (
              <Input {...textControl(control)} placeholder="https://upstream.example.com" className={fieldClassName} />
            )}
          </MountedFormField>
          <MountedFormField
            label={
              <FieldLabel label={t("teSubjectTypeLabel")} tooltip={t("teSubjectTypeTooltip")} />
            }
            name="subject_token_type"
          >
            {(control) => (
              <Input
                {...textControl(control)}
                placeholder="urn:ietf:params:oauth:token-type:access_token"
                className={fieldClassName}
              />
            )}
          </MountedFormField>
        </>
      )}
      <MountedFormField
        label={<FieldLabel label={scopesLabel} tooltip={scopesTooltip} />}
        name={["credentials", "scopes"]}
        required={isEntraObo}
        rules={scopesRules}
      >
        {(control) => (
          <MultiSelect {...tagsControl(control)} placeholder={scopesPlaceholder} className="rounded-lg" />
        )}
      </MountedFormField>
      <UpstreamTokenHeaderField />
    </>
  );
};

export default TokenExchangeFormFields;
