import React, { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import TagInfoView from "./tag_info";
import { modelInfoCall } from "@/components/networking";
import { tagCreateCall, tagListCall, tagDeleteCall } from "@/components/networking";
import { Tag } from "@/components/tag_management/types";
import TagTable from "./TagTable";
import { toast } from "@/lib/toast";
import DeleteResourceModal from "@/components/common_components/DeleteResourceModal";
import CreateTagModal from "./components/CreateTagModal";

interface ModelInfo {
  model_name: string;
  litellm_params: {
    model: string;
  };
  model_info: {
    id: string;
  };
}

interface TagProps {
  accessToken: string | null;
  userID: string | null;
  userRole: string | null;
}

const TagManagement: React.FC<TagProps> = ({ accessToken, userID, userRole }) => {
  const t = useTranslations("tagManagement");
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [editTag, setEditTag] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState("");
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);

  const fetchTags = async () => {
    if (!accessToken) {
      setIsLoadingTags(false);
      return;
    }
    try {
      const response = await tagListCall(accessToken);
      setTags(Object.values(response));
    } catch (error) {
      console.error("Error fetching tags:", error);
      toast.fromError(t("toastFetchFailed", { error: String(error) }));
    } finally {
      setIsLoadingTags(false);
    }
  };

  const handleRefreshClick = () => {
    fetchTags();
    const currentDate = new Date();
    setLastRefreshed(currentDate.toLocaleString());
  };

  const handleCreate = async (formValues: any) => {
    if (!accessToken) return;
    try {
      await tagCreateCall(accessToken, {
        name: formValues.tag_name,
        description: formValues.description,
        models: formValues.allowed_llms,
        max_budget: formValues.max_budget,
        soft_budget: formValues.soft_budget,
        tpm_limit: formValues.tpm_limit,
        rpm_limit: formValues.rpm_limit,
        budget_duration: formValues.budget_duration,
      });
      toast.success(t("toastCreated"));
      setIsCreateModalVisible(false);
      fetchTags();
    } catch (error) {
      console.error("Error creating tag:", error);
      toast.fromError(t("toastCreateFailed", { error: String(error) }));
    }
  };

  const handleDelete = async (tagName: string) => {
    setTagToDelete(tagName);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!accessToken || !tagToDelete) return;
    setIsDeleting(true);
    try {
      await tagDeleteCall(accessToken, tagToDelete);
      toast.success(t("toastDeleted"));
      fetchTags();
    } catch (error) {
      console.error("Error deleting tag:", error);
      toast.fromError(t("toastDeleteFailed", { error: String(error) }));
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setTagToDelete(null);
    }
  };

  useEffect(() => {
    if (userID && userRole && accessToken) {
      const fetchModels = async () => {
        try {
          const response = await modelInfoCall(accessToken, userID, userRole);
          if (response && response.data) {
            setAvailableModels(response.data);
          }
        } catch (error) {
          console.error("Error fetching models:", error);
          toast.fromError(t("toastModelsFailed", { error: String(error) }));
        }
      };
      fetchModels();
    }
  }, [accessToken, userID, userRole, t]);

  useEffect(() => {
    fetchTags();
  }, [accessToken]);

  return (
    <div className="mx-4 h-full">
      {selectedTagId ? (
        <TagInfoView
          tagId={selectedTagId}
          onClose={() => {
            setSelectedTagId(null);
            setEditTag(false);
          }}
          accessToken={accessToken}
          is_admin={userRole === "Admin"}
          editTag={editTag}
        />
      ) : (
        <div className="flex h-full w-full flex-col p-8 pt-10">
          <div className="mt-2 mb-4 flex w-full items-center justify-between">
            <h1>{t("tmTitle")}</h1>
            <div className="flex items-center space-x-2">
              {lastRefreshed && <p className="text-sm">{t("lastRefreshed")}{lastRefreshed}</p>}
              <Button variant="outline" size="icon-sm" aria-label={t("refreshAria")} onClick={handleRefreshClick}>
                <RefreshCw />
              </Button>
            </div>
          </div>

          <div className="mb-4 text-sm">
            {t("introClick")}
            <p>
              {t.rich("introRoutingRich", {
                link: (chunks) => (
                  <a href="https://docs.litellm.ai/docs/proxy/tag_routing" target="_blank" rel="noopener noreferrer">
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </div>

          <Button className="mb-4 self-start" onClick={() => setIsCreateModalVisible(true)}>
            + {t("createNewTag")}
          </Button>

          <div className="mt-2 flex min-h-0 flex-1 flex-col">
            <TagTable
              data={tags}
              isLoading={isLoadingTags}
              onEdit={(tag) => {
                setSelectedTagId(tag.name);
                setEditTag(true);
              }}
              onDelete={handleDelete}
              onSelectTag={setSelectedTagId}
            />
          </div>

          {/* Create Tag Modal */}
          <CreateTagModal
            visible={isCreateModalVisible}
            onCancel={() => setIsCreateModalVisible(false)}
            onSubmit={handleCreate}
            availableModels={availableModels}
          />

          {/* Delete Confirmation Modal */}
          <DeleteResourceModal
            isOpen={isDeleteModalOpen}
            title={t("deleteTitle")}
            message={t("deleteMessage")}
            resourceInformationTitle={t("deleteInfoTitle")}
            resourceInformation={[{ label: t("tagName"), value: tagToDelete, code: true }]}
            onCancel={() => {
              setIsDeleteModalOpen(false);
              setTagToDelete(null);
            }}
            onOk={confirmDelete}
            confirmLoading={isDeleting}
          />
        </div>
      )}
    </div>
  );
};

export default TagManagement;
