/**
 * The parent pane, showing list of budgets
 *
 */

import { Plus, Wallet } from "lucide-react";
import React, { useCallback, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { prism } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTranslations } from "next-intl";

import { useSyntaxTheme } from "@/hooks/useSyntaxTheme";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DeleteResourceModal from "@/components/common_components/DeleteResourceModal";
import { toast } from "@/lib/toast";
import { useBudgetList, useDeleteBudget, budgetItem } from "@/app/(dashboard)/hooks/budgets/useBudgets";
import BudgetModal from "./budget_modal";
import BudgetTable from "./BudgetTable";
import EditBudgetModal from "./edit_budget_modal";
import { CREATE_END_USER_CURL_COMMAND, CHAT_COMPLETIONS_CURL_COMMAND, OPENAI_SDK_PYTHON_CODE } from "./constants";
import useAuthorized from "@/app/(dashboard)/hooks/useAuthorized";
import { isProxyAdminRole } from "@/utils/roles";
import { formatNumberWithCommas } from "@/utils/dataUtils";

interface BudgetSettingsPageProps {
  accessToken: string | null;
}

const BudgetPanel: React.FC<BudgetSettingsPageProps> = ({ accessToken }) => {
  const t = useTranslations("budgets");
  const syntaxTheme = useSyntaxTheme(prism);
  const [isCreateModelVisible, setIsCreateModelVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<budgetItem | null>(null);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  const { userRole } = useAuthorized();
  // Admin Viewer follows the read-parity rule: see budgets, no writes.
  const canModify = isProxyAdminRole(userRole ?? "");

  const budgetList = useBudgetList();
  const deleteBudget = useDeleteBudget();

  // Stable identities keep the memoized column defs stable; new ones remount every header and cell.
  const handleEditCall = useCallback(
    (budget: budgetItem) => {
      if (accessToken == null) {
        return;
      }
      setSelectedBudget(budget);
      setIsEditModalVisible(true);
    },
    [accessToken],
  );

  const handleDeleteClick = useCallback((budget: budgetItem) => {
    setSelectedBudget(budget);
    setIsDeleteModalVisible(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!selectedBudget || accessToken == null) {
      return;
    }
    try {
      await deleteBudget.mutateAsync(selectedBudget.budget_id);
      toast.success(t("bpToastDeleted"));
    } catch (error) {
      console.error("Error deleting budget:", error);
      toast.fromError(t("bpToastDeleteFailed", { error: String(error) }));
    } finally {
      setIsDeleteModalVisible(false);
      setSelectedBudget(null);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalVisible(false);
  };

  return (
    <main className="flex h-full flex-col p-8">
      <Tabs defaultValue="budgets" className="min-h-0 flex-1 gap-6">
        <PageHeader
          icon={<Wallet />}
          title={t("bpTitle")}
          subtitle={t("bpSubtitle")}
          primaryAction={
            canModify ? (
              <Button onClick={() => setIsCreateModelVisible(true)}>
                <Plus className="size-4" />
                {t("create_budget")}
              </Button>
            ) : undefined
          }
          tabs={({ leadingControls }) => (
            <TabsList
              variant="line"
              className="gap-0 p-0 [&>[data-slot=tabs-trigger]+[data-slot=tabs-trigger]]:ml-[22px]"
            >
              {leadingControls}
              <TabsTrigger value="budgets" className="flex-none px-0 py-[7px] data-active:font-semibold">
                {t("bpTitle")}
              </TabsTrigger>
              <TabsTrigger value="examples" className="flex-none px-0 py-[7px] data-active:font-semibold">
                {t("bpTabExamples")}
              </TabsTrigger>
            </TabsList>
          )}
        />
        <TabsContent value="budgets" className="flex min-h-0 flex-1 flex-col" keepMounted>
          <div className="flex min-h-0 flex-1 flex-col">
            <BudgetModal isModalVisible={isCreateModelVisible} setIsModalVisible={setIsCreateModelVisible} />
            {selectedBudget && (
              <EditBudgetModal
                isModalVisible={isEditModalVisible}
                setIsModalVisible={setIsEditModalVisible}
                existingBudget={selectedBudget}
              />
            )}
            <BudgetTable
              list={budgetList}
              canModify={canModify}
              onEditClick={handleEditCall}
              onDeleteClick={handleDeleteClick}
            />
            <DeleteResourceModal
              isOpen={isDeleteModalVisible}
              title={t("bpDeleteTitle")}
              message={t("bpDeleteMessage")}
              resourceInformationTitle={t("bpDeleteInfoTitle")}
              resourceInformation={[
                { label: t("budgetId"), value: selectedBudget?.budget_id, code: true },
                {
                  label: t("maxBudget"),
                  value:
                    selectedBudget?.max_budget != null
                      ? `${formatNumberWithCommas(selectedBudget.max_budget)} tokens`
                      : null,
                },
                { label: "TPM", value: selectedBudget?.tpm_limit },
                { label: "RPM", value: selectedBudget?.rpm_limit },
              ]}
              onCancel={handleDeleteCancel}
              onOk={handleDeleteConfirm}
              confirmLoading={deleteBudget.isPending}
            />
          </div>
        </TabsContent>
        <TabsContent value="examples" className="min-h-0 flex-1 overflow-y-auto" keepMounted>
          <div className="pt-6">
            <p className="text-base text-muted-foreground">{t("bpHowToUse")}</p>
            <Tabs defaultValue="assign-budget">
              <TabsList variant="line" className="h-auto w-full justify-start rounded-none border-b p-0">
                <TabsTrigger value="assign-budget" className="flex-none rounded-none px-4 py-2">
                  {t("bpAssignToCustomer")}
                </TabsTrigger>
                <TabsTrigger value="curl" className="flex-none rounded-none px-4 py-2">
                  {t("bpTestCurl")}
                </TabsTrigger>
                <TabsTrigger value="openai-sdk" className="flex-none rounded-none px-4 py-2">
                  {t("bpTestSdk")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="assign-budget" keepMounted>
                <SyntaxHighlighter language="bash" style={syntaxTheme}>
                  {CREATE_END_USER_CURL_COMMAND}
                </SyntaxHighlighter>
              </TabsContent>
              <TabsContent value="curl" keepMounted>
                <SyntaxHighlighter language="bash" style={syntaxTheme}>
                  {CHAT_COMPLETIONS_CURL_COMMAND}
                </SyntaxHighlighter>
              </TabsContent>
              <TabsContent value="openai-sdk" keepMounted>
                <SyntaxHighlighter language="python" style={syntaxTheme}>
                  {OPENAI_SDK_PYTHON_CODE}
                </SyntaxHighlighter>
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
};

export default BudgetPanel;
