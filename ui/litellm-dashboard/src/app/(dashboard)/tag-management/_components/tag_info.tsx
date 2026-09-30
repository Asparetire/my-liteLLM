"use client";

import React, { useState, useEffect } from "react";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { z } from "zod/v4";
import { useTranslations } from "next-intl";
import { fetchUserModels } from "@/components/organisms/create_key_button";
import { getModelDisplayName } from "@/components/key_team_helpers/fetch_available_models_team_key";
import { tagInfoCall, tagUpdateCall } from "@/components/networking";
import { Tag, TagUpdateRequest } from "@/components/tag_management/types";
import { toast } from "@/lib/toast";
import NumericalInput from "@/components/shared/numerical_input";
import BudgetDurationDropdown from "@/components/common_components/budget_duration_dropdown";
import { FieldGroup } from "@/components/ui/field";
import { FormField } from "@/components/shared/form/FormField";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useZodForm } from "@/lib/forms/useZodForm";
import { copyToClipboard as utilCopyToClipboard } from "@/utils/dataUtils";
import { CheckIcon, ChevronRight, CopyIcon } from "lucide-react";

// Module-level schema for type inference only; the runtime schema comes from
// buildTagEditSchema so zod error messages can be translated.
const tagEditShape = {
  name: z.string(),
  description: z.string().optional(),
  models: z.array(z.string()).optional(),
  max_budget: z.union([z.string(), z.number()]).optional(),
  budget_duration: z.string().nullish(),
};

const tagEditSchema = z.object(tagEditShape);

const buildTagEditSchema = (messages: { nameRequired: string }) => {
  const shape = { ...tagEditShape, name: z.string().min(1, messages.nameRequired) };
  return z.object(shape);
};

type TagEditFormValues = z.output<typeof tagEditSchema>;

interface TagEditFormProps {
  tag: Tag;
  seedBudgetFields: boolean;
  userModels: string[];
  onCancel: () => void;
  onSave: (values: TagEditFormValues) => Promise<void>;
}

const TagEditForm: React.FC<TagEditFormProps> = ({ tag, seedBudgetFields, userModels, onCancel, onSave }) => {
  const t = useTranslations("tagManagement");
  const [budgetSectionOpen, setBudgetSectionOpen] = useState(false);
  const form = useZodForm(buildTagEditSchema({ nameRequired: t("nameRequired") }), {
    defaultValues: {
      name: tag.name,
      description: tag.description,
      models: tag.models,
      max_budget: seedBudgetFields ? tag.litellm_budget_table?.max_budget : undefined,
      budget_duration: seedBudgetFields ? tag.litellm_budget_table?.budget_duration : undefined,
    },
  });

  const submitVisibleValues = (values: TagEditFormValues): Promise<void> =>
    onSave(budgetSectionOpen ? values : { ...values, max_budget: undefined, budget_duration: undefined });

  const modelOptions = userModels.map((modelId) => ({ label: getModelDisplayName(modelId), value: modelId }));

  return (
    <form onSubmit={form.handleSubmit(submitVisibleValues)} noValidate>
      <FieldGroup>
        <FormField control={form.control} name="name" label={t("tagName")}>
          {({ ref, ...field }) => <Input {...field} ref={ref} />}
        </FormField>

        <FormField control={form.control} name="description" label={t("description")}>
          {({ ref, value, ...field }) => <Textarea {...field} ref={ref} value={value ?? ""} rows={4} />}
        </FormField>

        <FormField
          control={form.control}
          name="models"
          label={t("allowedModels")}
          description={t("allowedHintEdit")}
        >
          {({ value, onChange }) => (
            <MultiSelect options={modelOptions} value={value} onValueChange={onChange} placeholder={t("selectModels")} />
          )}
        </FormField>
      </FieldGroup>

      <Collapsible
        open={budgetSectionOpen}
        onOpenChange={setBudgetSectionOpen}
        className="mt-4 mb-4 rounded-md border border-border"
      >
        <CollapsibleTrigger className="group flex w-full items-center justify-between px-4 py-3 text-base font-medium text-foreground">
          {t("budgetSection")}
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-data-panel-open:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">
          <FieldGroup className="mt-4">
            <FormField
              control={form.control}
              name="max_budget"
              label={t("maxBudgetTokens")}
              description={t("maxBudgetHintEdit")}
            >
              {({ ref, value, ...field }) => <NumericalInput {...field} value={value ?? ""} step={1} />}
            </FormField>

            <FormField
              control={form.control}
              name="budget_duration"
              label={t("resetBudget")}
              description={t("resetBudgetHintEdit")}
            >
              {({ id, value, onChange }) => (
                <BudgetDurationDropdown id={id} value={value ?? null} onChange={onChange} />
              )}
            </FormField>
          </FieldGroup>

          <div className="mt-4 rounded-md border border-border bg-muted p-3">
            <p className="text-sm text-muted-foreground">
              {t.rich("tpmRpmNoteRich", {
                link: (chunks) => (
                  <a
                    href="https://github.com/BerriAI/litellm/issues/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-info underline hover:text-info/80"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit">{t("saveChanges")}</Button>
      </div>
    </form>
  );
};

interface TagInfoViewProps {
  tagId: string;
  onClose: () => void;
  accessToken: string | null;
  is_admin: boolean;
  editTag: boolean;
}

const TagInfoView: React.FC<TagInfoViewProps> = ({ tagId, onClose, accessToken, is_admin, editTag }) => {
  const t = useTranslations("tagManagement");
  const [tagDetails, setTagDetails] = useState<Tag | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(editTag);
  const [userModels, setUserModels] = useState<string[]>([]);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  const copyToClipboard = async (text: string | null | undefined, key: string) => {
    const success = await utilCopyToClipboard(text);
    if (success) {
      setCopiedStates((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [key]: false }));
      }, 2000);
    }
  };

  const fetchTagDetails = async () => {
    if (!accessToken) return;
    try {
      const response = await tagInfoCall(accessToken, [tagId]);
      const tagData = response[tagId];
      if (tagData) {
        setTagDetails(tagData);
      }
    } catch (error) {
      console.error("Error fetching tag details:", error);
      toast.fromError(t("toastDetailFetchFailed", { error: String(error) }));
    }
  };

  useEffect(() => {
    fetchTagDetails();
  }, [tagId, accessToken]);

  useEffect(() => {
    if (accessToken) {
      // Using dummy values for userID and userRole since they're required by the function
      // TODO: Pass these as props if needed for the actual API implementation
      fetchUserModels("dummy-user", "Admin", accessToken, setUserModels);
    }
  }, [accessToken]);

  const handleSave = async (values: TagEditFormValues) => {
    if (!accessToken) return;
    try {
      await tagUpdateCall(accessToken, {
        name: values.name,
        description: values.description,
        models: values.models as TagUpdateRequest["models"],
        max_budget: values.max_budget as TagUpdateRequest["max_budget"],
        tpm_limit: undefined,
        rpm_limit: undefined,
        budget_duration: values.budget_duration,
      });
      toast.success(t("toastUpdated"));
      setIsEditing(false);
      fetchTagDetails();
    } catch (error) {
      console.error("Error updating tag:", error);
      toast.fromError(t("toastUpdateFailed", { error: String(error) }));
    }
  };

  if (!tagDetails) {
    return <div>{t("loading")}</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Button onClick={onClose} className="mb-4">
            {t("backToTags")}
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t("tagNameColon")}</span>
            <span className="font-mono px-2 py-1 bg-muted rounded-sm text-sm border border-border">
              {tagDetails.name}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => copyToClipboard(tagDetails.name, "tag-name")}
              className={`transition-all duration-200 ${
                copiedStates["tag-name"]
                  ? "text-success bg-success/10 border-success/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {copiedStates["tag-name"] ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{tagDetails.description || t("noDescription")}</p>
        </div>
        {is_admin && !isEditing && <Button onClick={() => setIsEditing(true)}>{t("editTag")}</Button>}
      </div>

      {isEditing ? (
        <Card>
          <CardContent>
            <TagEditForm
              tag={tagDetails}
              seedBudgetFields={editTag}
              userModels={userModels}
              onCancel={() => setIsEditing(false)}
              onSave={handleSave}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent>
              <CardTitle>{t("tagDetails")}</CardTitle>
              <div className="space-y-4 mt-4">
                <div>
                  <p className="font-medium">{t("name")}</p>
                  <p>{tagDetails.name}</p>
                </div>
                <div>
                  <p className="font-medium">{t("description")}</p>
                  <p>{tagDetails.description || "-"}</p>
                </div>
                <div>
                  <p className="font-medium">{t("allowedModels")}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {!tagDetails.models || tagDetails.models.length === 0 ? (
                      <Badge variant="secondary">{t("allModels")}</Badge>
                    ) : (
                      tagDetails.models.map((modelId) => (
                        <Badge key={modelId} variant="secondary">
                          <SimpleTooltip content={`ID: ${modelId}`}>
                            {tagDetails.model_info?.[modelId] || modelId}
                          </SimpleTooltip>
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <p className="font-medium">{t("created")}</p>
                  <p>{tagDetails.created_at ? new Date(tagDetails.created_at).toLocaleString() : "-"}</p>
                </div>
                <div>
                  <p className="font-medium">{t("lastUpdated")}</p>
                  <p>{tagDetails.updated_at ? new Date(tagDetails.updated_at).toLocaleString() : "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {tagDetails.litellm_budget_table && (
            <Card>
              <CardContent>
                <CardTitle>{t("budgetSection")}</CardTitle>
                <div className="space-y-4 mt-4">
                  {tagDetails.litellm_budget_table.max_budget !== undefined &&
                    tagDetails.litellm_budget_table.max_budget !== null && (
                      <div>
                        <p className="font-medium">{t("maxBudget")}</p>
                        <p>${tagDetails.litellm_budget_table.max_budget}</p>
                      </div>
                    )}
                  {tagDetails.litellm_budget_table.budget_duration && (
                    <div>
                      <p className="font-medium">{t("resetBudget")}</p>
                      <p>{tagDetails.litellm_budget_table.budget_duration}</p>
                    </div>
                  )}
                  {tagDetails.litellm_budget_table.tpm_limit !== undefined &&
                    tagDetails.litellm_budget_table.tpm_limit !== null && (
                      <div>
                        <p className="font-medium">{t("tpmLimit")}</p>
                        <p>{tagDetails.litellm_budget_table.tpm_limit.toLocaleString()}</p>
                      </div>
                    )}
                  {tagDetails.litellm_budget_table.rpm_limit !== undefined &&
                    tagDetails.litellm_budget_table.rpm_limit !== null && (
                      <div>
                        <p className="font-medium">{t("rpmLimit")}</p>
                        <p>{tagDetails.litellm_budget_table.rpm_limit.toLocaleString()}</p>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default TagInfoView;
