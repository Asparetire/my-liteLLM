import { useEffect } from "react";
import { z } from "zod/v4";
import { useTranslations } from "next-intl";

import { useCloudZeroUpdateSettings } from "@/app/(dashboard)/hooks/cloudzero/useCloudZeroSettings";
import useAuthorized from "@/app/(dashboard)/hooks/useAuthorized";
import { FieldGroup } from "@/components/ui/field";
import { FormField } from "@/components/shared/form/FormField";
import { Input } from "@/components/ui/input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useZodForm } from "@/lib/forms/useZodForm";
import { toast } from "@/lib/toast";

import { CloudZeroApiKeyInput, labelWithHint } from "./CloudZeroFormControls";
import { buildCloudZeroPayload, EMPTY_CLOUDZERO_FORM_VALUES, type CloudZeroFormValues } from "./cloudZeroPayload";
import { CloudZeroSettings } from "./types";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CloudZeroUpdateModalProps {
  open: boolean;
  onOk: () => void;
  onCancel: () => void;
  settings: CloudZeroSettings;
}

export default function CloudZeroUpdateModal({ open, onOk, onCancel, settings }: CloudZeroUpdateModalProps) {
  const { accessToken } = useAuthorized();

  const t = useTranslations("cloudZero");

  const updateSchema = z.object({
  api_key: z.string(),
  connection_id: z.string().min(1, t("connectionIdRequired")),
  timezone: z.string(),
  });
  const form = useZodForm(updateSchema, { defaultValues: EMPTY_CLOUDZERO_FORM_VALUES });
  const updateMutation = useCloudZeroUpdateSettings(accessToken || "");

  useEffect(() => {
    if (open && settings) {
      form.reset({
        connection_id: settings.connection_id ?? "",
        timezone: settings.timezone || "UTC",
        api_key: "",
      });
    } else if (open) {
      form.reset(EMPTY_CLOUDZERO_FORM_VALUES);
    }
  }, [open, settings, form]);

  const handleSubmit = (values: CloudZeroFormValues) => {
    updateMutation.mutate(buildCloudZeroPayload(values), {
      onSuccess: () => {
        toast.success(t("toastUpdated"));
        form.reset(EMPTY_CLOUDZERO_FORM_VALUES);
        onOk();
      },
      onError: (error: Error) => {
        toast.error(error.message || t("toastUpdateFailed"));
      },
    });
  };

  const handleCancel = () => {
    form.reset(EMPTY_CLOUDZERO_FORM_VALUES);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
        </DialogHeader>
        <TooltipProvider>
          <form onSubmit={(event) => event.preventDefault()} noValidate>
            <FieldGroup>
              <FormField
                control={form.control}
                name="api_key"
                label={labelWithHint(t("apiKeyField"), t("apiKeyKeepHint"))}
              >
                {({ ref, ...field }) => (
                  <CloudZeroApiKeyInput {...field} ref={ref} placeholder={t("apiKeyKeepPlaceholder")} />
                )}
              </FormField>
              <FormField control={form.control} name="connection_id" label={t("connectionIdLabel")}>
                {({ ref, ...field }) => <Input {...field} ref={ref} placeholder={t("connectionIdPlaceholder")} />}
              </FormField>
              <FormField
                control={form.control}
                name="timezone"
                label={labelWithHint(t("timezoneLabel"), t("timezoneHint"))}
              >
                {({ ref, ...field }) => <Input {...field} ref={ref} placeholder="UTC" />}
              </FormField>
            </FieldGroup>
          </form>
        </TooltipProvider>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={updateMutation.isPending}>
            {t("cancel")}
          </Button>
          <Button
            onClick={() => void form.handleSubmit(handleSubmit)()}
            disabled={updateMutation.isPending}
            aria-busy={updateMutation.isPending}
          >
            {updateMutation.isPending ? t("updating") : t("update")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
