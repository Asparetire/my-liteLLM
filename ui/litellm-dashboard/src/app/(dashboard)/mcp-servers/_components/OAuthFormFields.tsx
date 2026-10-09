import { Info } from "lucide-react";
import React from "react";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OAUTH_FLOW } from "@/components/mcp_tools/types";
import { MountedFormField } from "@/components/common_components/MountedFormField";
import { requiredRule } from "@/components/common_components/formRules";
import TokenEndpointAuthMethodField from "./TokenEndpointAuthMethodField";
import UpstreamTokenHeaderField from "./UpstreamTokenHeaderField";
import {
  numberControl,
  parsesAsJson,
  selectControl,
  selectTriggerControl,
  tagsControl,
  textControl,
} from "./mcpFieldRules";

interface OAuthFlowStatus {
  startOAuthFlow: () => void;
  status: string;
  error: string | null;
  tokenResponse: { access_token?: string; expires_in?: number } | null;
}

interface OAuthFormFieldsProps {
  isM2M: boolean;
  isEditing?: boolean;
  oauthFlow?: OAuthFlowStatus;
  initialFlowType?: string;
  /** Link to provider docs for creating an OAuth app (e.g. GitHub). */
  docsUrl?: string | null;
}

const fieldClassName = "rounded-lg border-border focus:border-info focus:ring-ring";

const OAUTH_FLOW_ITEMS = [
  { value: OAUTH_FLOW.M2M, label: "Machine-to-Machine (M2M)" },
  { value: OAUTH_FLOW.INTERACTIVE, label: "Interactive (PKCE)" },
];

const FieldLabel: React.FC<{ label: string; tooltip: string }> = ({ label, tooltip }) => (
  <span className="text-sm font-medium text-foreground flex items-center">
    {label}
    <SimpleTooltip content={tooltip}>
      <Info className="ml-2 size-4 text-info hover:text-info/80 cursor-help" />
    </SimpleTooltip>
  </span>
);

const UpstreamResourceField: React.FC = () => {
  const t = useTranslations("mcpServers");
  return (
    <MountedFormField
      label={<FieldLabel label={t("oauthResourceLabel")} tooltip={t("oauthResourceTooltip")} />}
      name={["credentials", "upstream_resource"]}
    >
      {(control) => (
        <Input {...textControl(control)} placeholder={t("oauthResourcePlaceholder")} className={fieldClassName} />
      )}
    </MountedFormField>
  );
};

const OAuthFormFields: React.FC<OAuthFormFieldsProps> = ({
  isM2M,
  isEditing = false,
  oauthFlow,
  initialFlowType,
  docsUrl,
}) => {
  const t = useTranslations("mcpServers");
  const placeholderSuffix = isEditing ? t("oauthKeepExistingSuffix") : "";
  const requiredWhenCreating = (message: string) =>
    isEditing ? undefined : { validate: { required: requiredRule(message) } };
  const authorizeButtonLabels: Record<string, string> = {
    authorizing: t("oauthWaitingAuth"),
    exchanging: t("oauthExchanging"),
  };
  const authorizeButtonLabel = oauthFlow ? (authorizeButtonLabels[oauthFlow.status] ?? t("oauthAuthorizeFetch")) : "";

  return (
    <>
      <MountedFormField
        label={
          <FieldLabel label={t("oauthFlowTypeLabel")} tooltip={t("oauthFlowTypeTooltip")} />
        }
        name="oauth_flow_type"
        {...(initialFlowType ? { defaultValue: initialFlowType } : {})}
      >
        {(control) => (
          <Select {...selectControl<string>(control)} items={OAUTH_FLOW_ITEMS}>
            <SelectTrigger {...selectTriggerControl(control)} className="w-full rounded-lg">
              <SelectValue placeholder={t("oauthFlowPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={OAUTH_FLOW.M2M}>
                <div>
                  <span className="font-medium">Machine-to-Machine (M2M)</span>
                  <span className="ml-2 text-xs text-muted-foreground">{t("oauthFlowM2MDesc")}</span>
                </div>
              </SelectItem>
              <SelectItem value={OAUTH_FLOW.INTERACTIVE}>
                <div>
                  <span className="font-medium">Interactive (PKCE)</span>
                  <span className="ml-2 text-xs text-muted-foreground">{t("oauthFlowInteractiveDesc")}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </MountedFormField>

      {isM2M ? (
        <>
          <MountedFormField
            label={<FieldLabel label="Client ID" tooltip={t("oauthClientIdTooltip")} />}
            name={["credentials", "client_id"]}
            required={!isEditing}
            rules={requiredWhenCreating(t("oauthClientIdRequired"))}
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
              <FieldLabel label="Client Secret" tooltip={t("oauthClientSecretTooltip")} />
            }
            name={["credentials", "client_secret"]}
            required={!isEditing}
            rules={requiredWhenCreating(t("oauthClientSecretRequired"))}
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
            label={<FieldLabel label="Token URL" tooltip={t("oauthTokenUrlTooltip")} />}
            name="token_url"
            required={!isEditing}
            rules={requiredWhenCreating(t("oauthTokenUrlRequired"))}
          >
            {(control) => (
              <Input
                {...textControl(control)}
                placeholder="https://auth.example.com/oauth/token"
                className={fieldClassName}
              />
            )}
          </MountedFormField>
          <TokenEndpointAuthMethodField isEditing={isEditing} />
          <MountedFormField
            label={
              <FieldLabel label={t("oauthScopesLabel")} tooltip={t("oauthScopesTooltip")} />
            }
            name={["credentials", "scopes"]}
          >
            {(control) => <MultiSelect {...tagsControl(control)} placeholder={t("oauthScopesPlaceholder")} className="rounded-lg" />}
          </MountedFormField>
          <UpstreamResourceField />
          <UpstreamTokenHeaderField />
        </>
      ) : (
        <>
          <MountedFormField
            label={
              <span className="flex items-center justify-between w-full">
                <FieldLabel
                  label={t("oauthClientIdOptionalLabel")}
                  tooltip={t("oauthClientIdOptionalTooltip")}
                />
                {docsUrl && (
                  <a
                    href={docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-info hover:text-info/80 ml-2 font-normal"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t("oauthCreateAppLink")}
                  </a>
                )}
              </span>
            }
            name={["credentials", "client_id"]}
          >
            {(control) => (
              <PasswordInput
                {...textControl(control)}
                placeholder={t("oauthClientIdOptionalPlaceholder", { suffix: placeholderSuffix })}
                groupClassName={fieldClassName}
              />
            )}
          </MountedFormField>
          <MountedFormField
            label={
              <FieldLabel
                label={t("oauthClientSecretOptionalLabel")}
                tooltip={t("oauthClientIdOptionalTooltip")}
              />
            }
            name={["credentials", "client_secret"]}
          >
            {(control) => (
              <PasswordInput
                {...textControl(control)}
                placeholder={t("oauthClientSecretOptionalPlaceholder", { suffix: placeholderSuffix })}
                groupClassName={fieldClassName}
              />
            )}
          </MountedFormField>
          <MountedFormField
            label={
              <FieldLabel
                label={t("oauthScopesLabel")}
                tooltip={t("oauthInteractiveScopesTooltip")}
              />
            }
            name={["credentials", "scopes"]}
          >
            {(control) => <MultiSelect {...tagsControl(control)} placeholder={t("oauthScopesPlaceholder")} className="rounded-lg" />}
          </MountedFormField>
          <UpstreamResourceField />
          <UpstreamTokenHeaderField />
          <MountedFormField
            label={
              <FieldLabel
                label={t("oauthIssuerLabel")}
                tooltip={t("oauthIssuerTooltip")}
              />
            }
            name="issuer"
          >
            {(control) => (
              <Input {...textControl(control)} placeholder="https://issuer.example.com" className={fieldClassName} />
            )}
          </MountedFormField>
          <MountedFormField
            label={
              <FieldLabel label={t("oauthAuthUrlLabel")} tooltip={t("oauthAuthUrlTooltip")} />
            }
            name="authorization_url"
          >
            {(control) => (
              <Input
                {...textControl(control)}
                placeholder="https://example.com/oauth/authorize"
                className={fieldClassName}
              />
            )}
          </MountedFormField>
          <MountedFormField
            label={<FieldLabel label={t("oauthTokenUrlOptionalLabel")} tooltip={t("oauthTokenUrlOverrideTooltip")} />}
            name="token_url"
          >
            {(control) => (
              <Input
                {...textControl(control)}
                placeholder="https://example.com/oauth/token"
                className={fieldClassName}
              />
            )}
          </MountedFormField>
          <TokenEndpointAuthMethodField isEditing={isEditing} />
          <MountedFormField
            label={
              <FieldLabel
                label={t("oauthRegistrationUrlLabel")}
                tooltip={t("oauthRegistrationUrlTooltip")}
              />
            }
            name="registration_url"
          >
            {(control) => (
              <Input
                {...textControl(control)}
                placeholder="https://example.com/oauth/register"
                className={fieldClassName}
              />
            )}
          </MountedFormField>
          <MountedFormField
            label={
              <FieldLabel
                label={t("oauthTokenValidationLabel")}
                tooltip={t("oauthTokenValidationTooltip")}
              />
            }
            name="token_validation_json"
            rules={{ validate: { json: parsesAsJson(t("oauthInvalidJson")) } }}
          >
            {(control) => (
              <Textarea
                {...textControl(control)}
                placeholder={'{\n  "organization": "my-org",\n  "team.id": "123"\n}'}
                rows={4}
                className="font-mono text-sm rounded-lg border-border focus:border-info focus:ring-ring"
              />
            )}
          </MountedFormField>
          <MountedFormField
            label={
              <FieldLabel
                label={t("oauthTtlLabel")}
                tooltip={t("oauthTtlTooltip")}
              />
            }
            name="token_storage_ttl_seconds"
          >
            {(control) => (
              <Input {...numberControl(control)} min={1} placeholder={t("oauthTtlPlaceholder")} className="w-full rounded-lg" />
            )}
          </MountedFormField>
          {oauthFlow && (
            <div className="rounded-lg border border-dashed border-border p-4 space-y-2">
              <p className="text-sm text-muted-foreground">{t("oauthAuthorizeHint")}</p>
              <Button
                variant="secondary"
                onClick={oauthFlow.startOAuthFlow}
                disabled={oauthFlow.status === "authorizing" || oauthFlow.status === "exchanging"}
              >
                {authorizeButtonLabel}
              </Button>
              {oauthFlow.error && <p className="text-sm text-destructive">{oauthFlow.error}</p>}
              {oauthFlow.status === "success" && oauthFlow.tokenResponse?.access_token && (
                <p className="text-sm text-success">
                  {t("oauthTokenFetched", { seconds: oauthFlow.tokenResponse.expires_in ?? "?" })}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
};

export default OAuthFormFields;
