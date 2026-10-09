import { Info } from "lucide-react";
import React from "react";
import { useTranslations } from "next-intl";
import { SimpleTooltip } from "@/components/ui/tooltip";

import { MountedFormField } from "@/components/common_components/MountedFormField";
import UpstreamTokenHeaderField from "./UpstreamTokenHeaderField";
import { requiredRule } from "@/components/common_components/formRules";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requiredUnlessSiblingSet, tagsControl, textControl } from "./mcpFieldRules";

interface IdJagFormFieldsProps {
  isEditing?: boolean;
}

const fieldClassName = "rounded-lg border-border focus:border-info focus:ring-ring";

const FieldLabel: React.FC<{ label: string; tooltip: string }> = ({ label, tooltip }) => (
  <span className="text-sm font-medium text-foreground flex items-center">
    {label}
    <SimpleTooltip content={tooltip}>
      <Info className="ml-2 size-4 text-info hover:text-info/80 cursor-help" />
    </SimpleTooltip>
  </span>
);

const PRIVATE_KEY_PATH = ["credentials", "client_private_key"] as const;

const IdJagFormFields: React.FC<IdJagFormFieldsProps> = ({ isEditing = false }) => {
  const t = useTranslations("mcpServers");
  const placeholderSuffix = isEditing ? t("oauthKeepExistingSuffix") : "";
  const requiredWhenCreating = (message: string) =>
    isEditing ? undefined : { validate: { required: requiredRule(message) } };

  return (
    <>
      <MountedFormField
        label={
          <FieldLabel label={t("idJagOrgEndpointLabel")} tooltip={t("idJagOrgEndpointTooltip")} />
        }
        name="token_exchange_endpoint"
        required={!isEditing}
        rules={requiredWhenCreating(t("idJagOrgEndpointRequired"))}
      >
        {(control) => (
          <Input
            {...textControl(control)}
            placeholder="https://your-org.okta.com/oauth2/v1/token"
            className={fieldClassName}
          />
        )}
      </MountedFormField>
      <MountedFormField
        label={
          <FieldLabel label={t("idJagResourceEndpointLabel")} tooltip={t("idJagResourceEndpointTooltip")} />
        }
        name={["credentials", "id_jag_resource_token_endpoint"]}
        required={!isEditing}
        rules={requiredWhenCreating(t("idJagResourceEndpointRequired"))}
      >
        {(control) => (
          <Input
            {...textControl(control)}
            placeholder="https://upstream.example.com/oauth2/token"
            className={fieldClassName}
          />
        )}
      </MountedFormField>
      <MountedFormField
        label={<FieldLabel label="Client ID" tooltip={t("idJagClientIdTooltip")} />}
        name={["credentials", "client_id"]}
        required={!isEditing}
        rules={requiredWhenCreating(t("idJagClientIdRequired"))}
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
          <FieldLabel label="Client Secret" tooltip={t("idJagClientSecretTooltip")} />
        }
        name={["credentials", "client_secret"]}
        rules={
          isEditing
            ? undefined
            : {
                deps: ["credentials.client_private_key"],
                validate: {
                  secretOrPrivateKey: requiredUnlessSiblingSet(PRIVATE_KEY_PATH, t("idJagSecretOrKeyRequired")),
                },
              }
        }
      >
        {(control) => (
          <PasswordInput
            {...textControl(control)}
            placeholder={t("oauthClientSecretPlaceholder", { suffix: placeholderSuffix })}
            groupClassName={fieldClassName}
          />
        )}
      </MountedFormField>
      <MountedFormField
        label={
          <FieldLabel label={t("idJagPrivateKeyLabel")} tooltip={t("idJagPrivateKeyTooltip")} />
        }
        name={PRIVATE_KEY_PATH}
      >
        {(control) => (
          <Textarea
            {...textControl(control)}
            rows={3}
            placeholder={`-----BEGIN PRIVATE KEY-----${placeholderSuffix}`}
            className={fieldClassName}
          />
        )}
      </MountedFormField>
      <MountedFormField
        label={
          <FieldLabel label={t("idJagKeyIdLabel")} tooltip={t("idJagKeyIdTooltip")} />
        }
        name={["credentials", "client_private_key_id"]}
      >
        {(control) => <Input {...textControl(control)} placeholder="my-signing-key-1" className={fieldClassName} />}
      </MountedFormField>
      <MountedFormField
        label={
          <FieldLabel label={t("idJagAlgLabel")} tooltip={t("idJagAlgTooltip")} />
        }
        name={["credentials", "client_assertion_signing_alg"]}
      >
        {(control) => <Input {...textControl(control)} placeholder="RS256" className={fieldClassName} />}
      </MountedFormField>
      <MountedFormField
        label={
          <FieldLabel label={t("teAudienceLabel")} tooltip={t("idJagAudienceTooltip")} />
        }
        name="audience"
      >
        {(control) => (
          <Input {...textControl(control)} placeholder="https://upstream.example.com" className={fieldClassName} />
        )}
      </MountedFormField>
      <MountedFormField
        label={
          <FieldLabel label={t("oauthResourceLabel")} tooltip={t("idJagResourceIndicatorTooltip")} />
        }
        name={["credentials", "id_jag_resource"]}
      >
        {(control) => (
          <Input {...textControl(control)} placeholder="https://upstream.example.com/mcp" className={fieldClassName} />
        )}
      </MountedFormField>
      <MountedFormField
        label={
          <FieldLabel label={t("teSubjectTypeLabel")} tooltip={t("idJagSubjectTypeTooltip")} />
        }
        name="subject_token_type"
      >
        {(control) => (
          <Input
            {...textControl(control)}
            placeholder="urn:ietf:params:oauth:token-type:id_token"
            className={fieldClassName}
          />
        )}
      </MountedFormField>
      <MountedFormField
        label={<FieldLabel label={t("oauthScopesLabel")} tooltip={t("idJagScopesTooltip")} />}
        name={["credentials", "scopes"]}
      >
        {(control) => <MultiSelect {...tagsControl(control)} placeholder={t("oauthScopesPlaceholder")} className="rounded-lg" />}
      </MountedFormField>
      <UpstreamTokenHeaderField />
    </>
  );
};

export default IdJagFormFields;
