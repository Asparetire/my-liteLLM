import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import CopyButton from "@/components/shared/CopyButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JsonViewer } from "./JsonViewer";

interface ClassifierAuditViewProps {
  request: Record<string, unknown>;
  response: unknown;
}

export function ClassifierAuditView({ request, response }: ClassifierAuditViewProps) {
  const t = useTranslations("logs");
  return (
    <div className="mb-6 space-y-4">
      <AuditField title={t("classifierInputTitle")} value={request.classifier_input}>
        {t("classifierInputDesc")}
      </AuditField>
      <AuditField title={t("originatingRequestTitle")} value={request.originating_request_masked}>
        {t("originatingRequestDesc")}
      </AuditField>
      <AuditField title={t("classifierResponseTitle")} value={response}>
        {t("classifierResponseDesc")}
      </AuditField>
    </div>
  );
}

function AuditField({ title, value, children }: { title: string; value: unknown; children: ReactNode }) {
  const t = useTranslations("logs");
  const serialized = JSON.stringify(value);
  const truncated = serialized?.includes("litellm_truncated") ?? false;

  return (
    <Card size="sm" role="region" aria-label={title}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {value != null && <CopyButton value={JSON.stringify(value, null, 2)} label={t("copyField", { title })} />}
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">{children}</p>
        {truncated && (
          <p role="status" className="mb-3 text-sm text-warning">
            {t("truncatedCopyNote")}
          </p>
        )}
        {value == null ? (
          <p className="text-sm text-muted-foreground">{t("notCaptured")}</p>
        ) : (
          <JsonViewer data={value} mode="formatted" />
        )}
      </CardContent>
    </Card>
  );
}
