import { Info } from "lucide-react";
import React from "react";
import { useTranslations } from "next-intl";
import { SimpleTooltip } from "@/components/ui/tooltip";

import { MountedFormField } from "@/components/common_components/MountedFormField";
import { requiredRule } from "@/components/common_components/formRules";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { Input } from "@/components/ui/input";
import { requiredWhenSiblingSet, textControl } from "./mcpFieldRules";

const fieldClassName = "rounded-lg border-border focus:border-info focus:ring-ring";

const FieldLabel: React.FC<{ label: string; tooltip: string }> = ({ label, tooltip }) => (
  <span className="text-sm font-medium text-foreground flex items-center">
    {label}
    <SimpleTooltip content={tooltip}>
      <Info className="ml-2 size-4 text-info hover:text-info/80 cursor-help" />
    </SimpleTooltip>
  </span>
);

const ACCESS_KEY_PATH = ["credentials", "aws_access_key_id"] as const;
const SECRET_KEY_PATH = ["credentials", "aws_secret_access_key"] as const;

const AwsSigV4Fields: React.FC = () => {
  const t = useTranslations("mcpServers");
  return (
    <>
      <p className="text-sm text-muted-foreground mb-2">
        {t("awsIntro")}{" "}
        <a
          href="https://docs.litellm.ai/docs/mcp_aws_sigv4"
          target="_blank"
          rel="noopener noreferrer"
          className="text-info hover:text-info/80"
        >
          {t("awsViewDocs")}
        </a>
      </p>
      <MountedFormField
        label={<FieldLabel label={t("awsRegionLabel")} tooltip={t("awsRegionTooltip")} />}
        name={["credentials", "aws_region_name"]}
        required
        rules={{ validate: { required: requiredRule(t("awsRegionRequired")) } }}
      >
        {(control) => <Input {...textControl(control)} placeholder="us-east-1" className={fieldClassName} />}
      </MountedFormField>
      <MountedFormField
        label={<FieldLabel label={t("awsServiceLabel")} tooltip={t("awsServiceTooltip")} />}
        name={["credentials", "aws_service_name"]}
      >
        {(control) => <Input {...textControl(control)} placeholder="bedrock-agentcore" className={fieldClassName} />}
      </MountedFormField>
      <MountedFormField
        label={<FieldLabel label={t("awsAccessKeyLabel")} tooltip={t("awsAccessKeyTooltip")} />}
        name={ACCESS_KEY_PATH}
        rules={{
          deps: ["credentials.aws_secret_access_key"],
          validate: {
            pairedWithSecret: requiredWhenSiblingSet(SECRET_KEY_PATH, t("awsAccessKeyPair")),
          },
        }}
      >
        {(control) => (
          <PasswordInput
            {...textControl(control)}
            placeholder={t("awsAccessKeyPlaceholder")}
            groupClassName={fieldClassName}
          />
        )}
      </MountedFormField>
      <MountedFormField
        label={<FieldLabel label={t("awsSecretLabel")} tooltip={t("awsSecretTooltip")} />}
        name={SECRET_KEY_PATH}
        rules={{
          deps: ["credentials.aws_access_key_id"],
          validate: {
            pairedWithAccessKey: requiredWhenSiblingSet(ACCESS_KEY_PATH, t("awsSecretPair")),
          },
        }}
      >
        {(control) => (
          <PasswordInput
            {...textControl(control)}
            placeholder={t("awsSecretPlaceholder")}
            groupClassName={fieldClassName}
          />
        )}
      </MountedFormField>
      <MountedFormField
        label={<FieldLabel label={t("awsSessionTokenLabel")} tooltip={t("awsSessionTokenTooltip")} />}
        name={["credentials", "aws_session_token"]}
      >
        {(control) => (
          <PasswordInput
            {...textControl(control)}
            placeholder={t("awsSessionTokenPlaceholder")}
            groupClassName={fieldClassName}
          />
        )}
      </MountedFormField>
      <MountedFormField
        label={<FieldLabel label={t("awsRoleArnLabel")} tooltip={t("awsRoleArnTooltip")} />}
        name={["credentials", "aws_role_name"]}
      >
        {(control) => (
          <Input
            {...textControl(control)}
            placeholder="arn:aws:iam::123456789012:role/MyRole（可选）"
            className={fieldClassName}
          />
        )}
      </MountedFormField>
      <MountedFormField
        label={<FieldLabel label={t("awsSessionNameLabel")} tooltip={t("awsSessionNameTooltip")} />}
        name={["credentials", "aws_session_name"]}
      >
        {(control) => (
          <Input
            {...textControl(control)}
            placeholder="litellm-prod（可选，留空时自动生成）"
            className={fieldClassName}
          />
        )}
      </MountedFormField>
    </>
  );
};

export default AwsSigV4Fields;
