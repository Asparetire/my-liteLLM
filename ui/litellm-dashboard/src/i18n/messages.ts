import type { AbstractIntlMessages } from "next-intl";

import en from "../../messages/en.json";
import zhCN from "../../messages/zh-CN.json";
import type { Locale } from "./config";

// Both locales ship to the client: static export has no server-side message
// loading, and the switcher must re-render without a rebuild.
export const MESSAGES: Record<Locale, AbstractIntlMessages> = {
  en,
  "zh-CN": zhCN,
};
