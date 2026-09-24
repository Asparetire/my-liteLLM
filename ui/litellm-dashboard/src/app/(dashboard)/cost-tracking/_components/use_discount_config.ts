import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { getProxyBaseUrl, getGlobalLitellmHeaderName } from "@/components/networking";
import { toast } from "@/lib/toast";
import { DiscountConfig } from "./types";
import { getProviderBackendValue } from "./provider_display_helpers";
import { Providers } from "@/components/provider_info_helpers";

export interface UseDiscountConfigProps {
  accessToken: string | null;
}

export interface UseDiscountConfigReturn {
  discountConfig: DiscountConfig;
  setDiscountConfig: React.Dispatch<React.SetStateAction<DiscountConfig>>;
  fetchDiscountConfig: () => Promise<void>;
  saveDiscountConfig: (config: DiscountConfig) => Promise<void>;
  handleAddProvider: (selectedProvider: string | undefined, newDiscount: string) => Promise<boolean>;
  handleRemoveProvider: (provider: string) => Promise<void>;
  handleDiscountChange: (provider: string, value: string) => Promise<void>;
}

export function useDiscountConfig({ accessToken }: UseDiscountConfigProps): UseDiscountConfigReturn {
  const t = useTranslations("costTracking");
  const [discountConfig, setDiscountConfig] = useState<DiscountConfig>({});

  const fetchDiscountConfig = useCallback(async () => {
    try {
      const proxyBaseUrl = getProxyBaseUrl();
      const url = proxyBaseUrl ? `${proxyBaseUrl}/config/cost_discount_config` : "/config/cost_discount_config";

      const response = await fetch(url, {
        method: "GET",
        headers: {
          [getGlobalLitellmHeaderName()]: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDiscountConfig(data.values || {});
      } else {
        console.error("Failed to fetch discount config");
      }
    } catch (error) {
      console.error("Error fetching discount config:", error);
      toast.fromError(t("fetchDiscountFailed"));
    }
  }, [accessToken, t]);

  const saveDiscountConfig = useCallback(
    async (config: DiscountConfig) => {
      try {
        const proxyBaseUrl = getProxyBaseUrl();
        const url = proxyBaseUrl ? `${proxyBaseUrl}/config/cost_discount_config` : "/config/cost_discount_config";

        const response = await fetch(url, {
          method: "PATCH",
          headers: {
            [getGlobalLitellmHeaderName()]: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        });

        if (response.ok) {
          toast.success(t("discountConfigUpdated"));
          await fetchDiscountConfig();
        } else {
          const errorData = await response.json();
          const errorMessage = errorData.detail?.error || errorData.detail || t("updateSettingsFailed");
          toast.fromError(errorMessage);
        }
      } catch (error) {
        console.error("Error updating discount config:", error);
        toast.fromError(t("updateDiscountFailed"));
      }
    },
    [accessToken, fetchDiscountConfig, t],
  );

  const handleAddProvider = useCallback(
    async (selectedProvider: string | undefined, newDiscount: string): Promise<boolean> => {
      if (!selectedProvider || !newDiscount) {
        toast.fromError(t("selectProviderAndDiscount"));
        return false;
      }

      const percentageValue = parseFloat(newDiscount);
      if (isNaN(percentageValue) || percentageValue < 0 || percentageValue > 100) {
        toast.fromError(t("discountRangeInvalid"));
        return false;
      }

      const providerValue = getProviderBackendValue(selectedProvider);

      if (!providerValue) {
        toast.fromError(t("invalidProvider"));
        return false;
      }

      if (discountConfig[providerValue]) {
        toast.fromError(t("discountExists", { name: Providers[selectedProvider as keyof typeof Providers] }));
        return false;
      }

      const discountValue = percentageValue / 100;
      const updatedConfig = {
        ...discountConfig,
        [providerValue]: discountValue,
      };

      setDiscountConfig(updatedConfig);
      await saveDiscountConfig(updatedConfig);
      return true;
    },
    [discountConfig, saveDiscountConfig, t],
  );

  const handleRemoveProvider = useCallback(
    async (provider: string) => {
      const updatedConfig = { ...discountConfig };
      delete updatedConfig[provider];
      setDiscountConfig(updatedConfig);
      await saveDiscountConfig(updatedConfig);
    },
    [discountConfig, saveDiscountConfig],
  );

  const handleDiscountChange = useCallback(
    async (provider: string, value: string) => {
      const discountValue = parseFloat(value);
      if (!isNaN(discountValue) && discountValue >= 0 && discountValue <= 1) {
        const updatedConfig = {
          ...discountConfig,
          [provider]: discountValue,
        };
        setDiscountConfig(updatedConfig);
        await saveDiscountConfig(updatedConfig);
      }
    },
    [discountConfig, saveDiscountConfig],
  );

  return {
    discountConfig,
    setDiscountConfig,
    fetchDiscountConfig,
    saveDiscountConfig,
    handleAddProvider,
    handleRemoveProvider,
    handleDiscountChange,
  };
}
