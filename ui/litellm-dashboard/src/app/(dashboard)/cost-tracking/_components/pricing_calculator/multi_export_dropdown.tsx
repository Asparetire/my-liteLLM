import React from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MultiModelResult } from "./types";
import { exportMultiToPDF, exportMultiToCSV } from "./multi_export_utils";

interface MultiExportDropdownProps {
  multiResult: MultiModelResult;
}

const MultiExportDropdown: React.FC<MultiExportDropdownProps> = ({ multiResult }) => {
  const t = useTranslations("costTracking");
  const hasResults = multiResult.entries.some((e) => e.result !== null);

  if (!hasResults) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ variant: "secondary", size: "xs" })}>
        <Download />
        {t("exportLabel")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => exportMultiToPDF(multiResult, t)}>
          <FileText />
          {t("exportPdf")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportMultiToCSV(multiResult, t)}>
          <FileSpreadsheet />
          {t("exportCsv")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MultiExportDropdown;
