import { useCloudZeroDryRun } from "@/app/(dashboard)/hooks/cloudzero/useCloudZeroDryRun";
import { useCloudZeroExport } from "@/app/(dashboard)/hooks/cloudzero/useCloudZeroExport";
import { useCloudZeroDeleteSettings } from "@/app/(dashboard)/hooks/cloudzero/useCloudZeroSettings";
import useAuthorized from "@/app/(dashboard)/hooks/useAuthorized";
import DeleteResourceModal from "@/components/common_components/DeleteResourceModal";
import { Alert, AlertDescription, AlertTitle } from "@/components/shared/Alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import { CheckCircle, Pencil, Play, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import CloudZeroUpdateModal from "./CloudZeroUpdateModal";
import { CloudZeroSettings } from "./types";

interface CloudZeroIntegrationSettingsProps {
  settings: CloudZeroSettings;
  onSettingsUpdated: () => void;
}

interface DetailRowProps {
  label: string;
  children: React.ReactNode;
}

const DetailRow = ({ label, children }: DetailRowProps) => (
  <div className="grid grid-cols-1 border-b border-border last:border-b-0 sm:grid-cols-[220px_minmax(0,1fr)]">
    <dt className="bg-muted/50 px-4 py-3 text-sm font-medium">{label}</dt>
    <dd className="px-4 py-3 text-sm">{children}</dd>
  </div>
);

const NotConfigured = () => {
  const t = useTranslations("cloudZero");
  return <span className="text-muted-foreground italic">{t("notConfigured")}</span>;
};

export function CloudZeroIntegrationSettings({ settings, onSettingsUpdated }: CloudZeroIntegrationSettingsProps) {
  const t = useTranslations("cloudZero");
  const { accessToken } = useAuthorized();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isExportConfirmOpen, setIsExportConfirmOpen] = useState(false);

  const dryRunMutation = useCloudZeroDryRun(accessToken || "");
  const exportMutation = useCloudZeroExport(accessToken || "");
  const deleteMutation = useCloudZeroDeleteSettings(accessToken || "");

  const handleDryRun = () => {
    if (!accessToken) return;

    dryRunMutation.mutate(
      { limit: 10 },
      {
        onSuccess: () => {
          toast.success(t("toastDryRunSuccess"));
        },
        onError: (error) => {
          toast.error(error?.message || t("toastDryRunFailed"));
        },
      },
    );
  };

  const dryRunResult = dryRunMutation.data ? JSON.stringify(dryRunMutation.data, null, 2) : null;

  const handleExport = () => {
    if (!accessToken) return;

    exportMutation.mutate(
      { operation: "replace_hourly" },
      {
        onSuccess: () => {
          toast.success(t("toastExportSuccess"));
          setIsExportConfirmOpen(false);
        },
        onError: (error) => {
          toast.error(error?.message || t("toastExportFailed"));
        },
      },
    );
  };

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  const handleEditModalOk = async () => {
    setIsEditModalOpen(false);
    onSettingsUpdated();
  };

  const handleEditModalCancel = () => {
    setIsEditModalOpen(false);
  };

  const handleDeleteClick = () => {
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!accessToken) return;

    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success(t("toastDeleteSuccess"));
        setIsDeleteModalOpen(false);
        onSettingsUpdated();
      },
      onError: (error) => {
        toast.error(error?.message || t("toastDeleteFailed"));
      },
    });
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
  };

  return (
    <>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {t("configTitle")}
              <Badge variant="secondary" className="capitalize">
                {settings.status || t("statusActive")}
              </Badge>
            </CardTitle>
            <CardAction className="flex gap-2">
              <Button variant="outline" onClick={handleEdit}>
                <Pencil />
                {t("edit")}
              </Button>
              <Button variant="destructive" onClick={handleDeleteClick}>
                <Trash2 />
                {t("delete")}
              </Button>
            </CardAction>
          </CardHeader>

          <CardContent>
            <dl className="rounded-md border border-border">
              <DetailRow label={t("apiKeyLabel")}>
                <span className="font-mono">{settings.api_key_masked || <NotConfigured />}</span>
              </DetailRow>
              <DetailRow label={t("connectionIdLabel")}>
                <span className="font-mono">{settings.connection_id || <NotConfigured />}</span>
              </DetailRow>
              <DetailRow label={t("timezoneLabel")}>
                {settings.timezone || <span className="text-muted-foreground italic">{t("timezoneDefault")}</span>}
              </DetailRow>
            </dl>

            <div className="mt-6 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{t("actionsLabel")}</span>
              <Separator className="flex-1" />
            </div>

            <div className="mt-4 mb-6 flex flex-wrap gap-4">
              <Button variant="outline" onClick={handleDryRun} disabled={dryRunMutation.isPending}>
                <Play />
                {t("runDryRun")}
              </Button>

              <Button onClick={() => setIsExportConfirmOpen(true)} disabled={exportMutation.isPending}>
                <Upload />
                {t("exportNow")}
              </Button>
            </div>

            {dryRunResult && (
              <Alert>
                <CheckCircle />
                <AlertTitle>{t("dryRunResults")}</AlertTitle>
                <AlertDescription>
                  <p>{t("dryRunOutputFor", { id: settings.connection_id ?? "" })}</p>
                  <pre className="overflow-x-auto rounded-md border border-border bg-muted p-4 font-mono text-xs text-foreground">
                    {dryRunResult}
                  </pre>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={isExportConfirmOpen} onOpenChange={setIsExportConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("exportTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("exportConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={exportMutation.isPending}>{t("cancel")}</AlertDialogCancel>
            <Button onClick={handleExport} disabled={exportMutation.isPending}>
              {t("export")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CloudZeroUpdateModal
        open={isEditModalOpen}
        onOk={handleEditModalOk}
        onCancel={handleEditModalCancel}
        settings={settings}
      />

      <DeleteResourceModal
        isOpen={isDeleteModalOpen}
        title={t("deleteTitle")}
        message={t("deleteMessage")}
        resourceInformationTitle={t("integrationDetails")}
        resourceInformation={[
          {
            label: t("connectionIdLabel"),
            value: settings.connection_id,
            code: true,
          },
          {
            label: t("timezoneLabel"),
            value: settings.timezone || t("timezoneDefault"),
          },
        ]}
        onCancel={handleDeleteCancel}
        onOk={handleDeleteConfirm}
        confirmLoading={deleteMutation.isPending}
      />
    </>
  );
}
