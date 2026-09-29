import { BarChart3, Bot, Building2, Globe, LineChart, ShoppingCart, Tags, User, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hasCapability, type Capability } from "@/utils/capabilities";
import { all_admin_roles } from "@/utils/roles";
export type UsageOption =
  | "global"
  | "my-usage"
  | "organization"
  | "team"
  | "customer"
  | "tag"
  | "agent"
  | "user"
  | "user-agent-activity";
export interface UsageViewSelectProps {
  value: UsageOption;
  onChange: (value: UsageOption) => void;
  userRole: string | null;
  canViewTagUsage?: boolean;
  isOrgAdmin?: boolean;
  title?: string;
  description?: string;
  "data-id"?: string;
}
interface OptionConfig {
  value: UsageOption;
  labelKey: string;
  descriptionKey: string;
  nonAdminLabelKey?: string;
  nonAdminDescriptionKey?: string;
  icon: React.ReactNode;
  capability?: Capability;
  adminOnly?: boolean;
  badgeText?: string;
}
const OPTIONS: OptionConfig[] = [
  {
    value: "global",
    labelKey: "viewGlobal",
    nonAdminLabelKey: "viewYourUsage",
    descriptionKey: "viewGlobalDesc",
    nonAdminDescriptionKey: "viewYourUsageDesc",
    icon: <Globe className="size-4" />,
  },
  {
    value: "my-usage",
    labelKey: "viewMyUsage",
    descriptionKey: "viewMyUsageDesc",
    icon: <User className="size-4" />,
    adminOnly: true,
  },
  {
    value: "organization",
    labelKey: "viewOrganization",
    descriptionKey: "viewOrganizationDesc",
    icon: <Building2 className="size-4" />,
    capability: "viewOrganizationUsage",
  },
  {
    value: "team",
    labelKey: "viewTeam",
    descriptionKey: "viewTeamDesc",
    icon: <Users className="size-4" />,
  },
  {
    value: "customer",
    labelKey: "viewCustomer",
    descriptionKey: "viewCustomerDesc",
    icon: <ShoppingCart className="size-4" />,
    adminOnly: true,
  },
  {
    value: "tag",
    labelKey: "viewTag",
    descriptionKey: "viewTagDesc",
    icon: <Tags className="size-4" />,
    adminOnly: true,
  },
  {
    value: "agent",
    labelKey: "viewAgent",
    descriptionKey: "viewAgentDesc",
    icon: <Bot className="size-4" />,
    capability: "viewAgentUsage",
  },
  {
    value: "user",
    labelKey: "viewUser",
    descriptionKey: "viewUserDesc",
    icon: <User className="size-4" />,
    adminOnly: true,
  },
  {
    value: "user-agent-activity",
    labelKey: "viewUserAgentActivity",
    descriptionKey: "viewUserAgentActivityDesc",
    icon: <LineChart className="size-4" />,
    adminOnly: true,
  },
];
export const UsageViewSelect: React.FC<UsageViewSelectProps> = ({
  value,
  onChange,
  userRole,
  canViewTagUsage = false,
  isOrgAdmin = false,
  title,
  description,
  "data-id": dataId,
}) => {
  const t = useTranslations("usage");
  const isAdmin = all_admin_roles.includes(userRole ?? "");
  const heading = title ?? t("usageViewTitle");
  const subheading = description ?? t("usageViewDescription");
  const getFilteredOptions = () => {
    return OPTIONS.filter((option) => {
      if (option.capability) {
        return hasCapability(userRole, option.capability, isOrgAdmin);
      }
      if (option.value === "tag" && canViewTagUsage) {
        return true;
      }
      if (option.adminOnly && !isAdmin) {
        return false;
      }
      return true;
    }).map((option) => {
      const label = isAdmin || !option.nonAdminLabelKey ? t(option.labelKey) : t(option.nonAdminLabelKey);
      const desc =
        isAdmin || !option.nonAdminDescriptionKey
          ? t(option.descriptionKey)
          : t(option.nonAdminDescriptionKey);
      return {
        value: option.value,
        label,
        description: desc,
        icon: option.icon,
        badgeText: option.badgeText,
      };
    });
  };
  const filteredOptions = getFilteredOptions();
  const selectedOption = filteredOptions.find((option) => option.value === value);
  return (
    <div className="w-full" data-id={dataId}>
      <div className="flex flex-wrap items-center justify-start gap-4">
        <div className="flex items-stretch gap-2 min-w-0">
          <div className="shrink-0 flex items-center">
            <BarChart3 className="size-8" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground mb-0.5 leading-tight">{heading}</h3>
            <p className="text-xs text-muted-foreground leading-tight">{subheading}</p>
          </div>
        </div>
        <div className="shrink-0">
          <Select
            value={value}
            onValueChange={(next: UsageOption | null) => {
              if (next) onChange(next);
            }}
          >
            <SelectTrigger className="w-54 sm:w-64 md:w-72">
              <SelectValue>
                {selectedOption && (
                  <span className="flex items-center gap-2">
                    {selectedOption.icon}
                    <span className="text-sm">{selectedOption.label}</span>
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {filteredOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="flex items-center gap-2 py-1">
                    <span className="shrink-0 mt-0.5">{option.icon}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-foreground">{option.label}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">{option.description}</span>
                    </span>
                    {option.badgeText && <Badge>{option.badgeText}</Badge>}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
