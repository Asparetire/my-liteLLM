"use client";
import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import ModelHubTable from "@/components/AIHub/ModelHubTable";

function PublicModelHubTableContent() {
  const searchParams = useSearchParams()!;
  const key = searchParams.get("key");
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    if (!key) {
      return;
    }
    setAccessToken(key);
  }, [key]);

  return <ModelHubTable accessToken={accessToken} publicPage={true} premiumUser={false} userRole={null} />;
}

export default function PublicModelHubTable() {
  const t = useTranslations("common");
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">{t("loading")}</div>}>
      <PublicModelHubTableContent />
    </Suspense>
  );
}
