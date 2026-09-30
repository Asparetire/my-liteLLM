import React from "react";
import { useTranslations } from "next-intl";
import { UiLoadingSpinner } from "@/components/ui/ui-loading-spinner";

export function OnboardingLoadingView() {
  const t = useTranslations("onboarding");
  return (
    <div className="mx-auto w-full max-w-md mt-10 flex justify-center">
      <UiLoadingSpinner role="status" aria-label={t("loading")} className="size-8 text-muted-foreground" />
    </div>
  );
}
