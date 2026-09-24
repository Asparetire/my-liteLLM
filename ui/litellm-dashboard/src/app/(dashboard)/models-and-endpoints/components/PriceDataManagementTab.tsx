import PriceDataReload from "@/components/price_data_reload";
import React from "react";
import { useTranslations } from "next-intl";
import useAuthorized from "@/app/(dashboard)/hooks/useAuthorized";
import { useModelCostMap } from "../../hooks/models/useModelCostMap";

const PriceDataManagementTab = () => {
  const t = useTranslations("modelsEndpoints");
  const { accessToken } = useAuthorized();
  const { refetch: refetchModelCostMap } = useModelCostMap();

  return (
    <div>
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">{t("priceDataManagementTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("priceDataManagementDesc")}</p>
        </div>
        <PriceDataReload
          accessToken={accessToken}
          onReloadSuccess={() => {
            refetchModelCostMap();
          }}
          buttonText={t("reloadPriceData")}
          size="middle"
          type="primary"
          className="w-full"
        />
      </div>
    </div>
  );
};

export default PriceDataManagementTab;
