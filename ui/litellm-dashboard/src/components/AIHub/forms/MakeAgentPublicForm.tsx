import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/cva.config";
import { makeAgentsPublicCall } from "../../networking";
import { toast } from "@/lib/toast";
import { AgentHubData } from "@/components/AIHub/AgentHubTableColumns";

const STEP_TITLE_KEYS = ["stepSelect", "stepConfirm"];

interface MakeAgentPublicFormProps {
  visible: boolean;
  onClose: () => void;
  accessToken: string;
  agentHubData: AgentHubData[];
  onSuccess: () => void;
}

const MakeAgentPublicForm: React.FC<MakeAgentPublicFormProps> = ({
  visible,
  onClose,
  accessToken,
  agentHubData,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const t = useTranslations("aiHub");
  const entity = t("entityAgent");

  const handleClose = () => {
    setCurrentStep(0);
    setSelectedAgents(new Set());
    onClose();
  };

  const handleNext = () => {
    if (currentStep === 0) {
      if (selectedAgents.size === 0) {
        toast.fromError(t("selectAtLeastOne", { entity }));
        return;
      }
      setCurrentStep(1);
    }
  };

  const handlePrevious = () => {
    if (currentStep === 1) {
      setCurrentStep(0);
    }
  };

  const handleAgentSelection = (agentId: string, checked: boolean) => {
    const newSelection = new Set(selectedAgents);
    if (checked) {
      newSelection.add(agentId);
    } else {
      newSelection.delete(agentId);
    }
    setSelectedAgents(newSelection);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allAgentIds = agentHubData.map((agent) => agent.agent_id || agent.name);
      setSelectedAgents(new Set(allAgentIds));
    } else {
      setSelectedAgents(new Set());
    }
  };

  // Initialize and preselect already public agents when modal opens
  useEffect(() => {
    if (visible && agentHubData.length > 0) {
      // Preselect agents that are already public
      const alreadyPublicAgents = agentHubData
        .filter((agent) => agent.is_public === true)
        .map((agent) => agent.agent_id || agent.name);

      setSelectedAgents(new Set(alreadyPublicAgents));
    }
  }, [visible, agentHubData]);

  const handleSubmit = async () => {
    if (selectedAgents.size === 0) {
      toast.fromError(t("selectAtLeastOne", { entity }));
      return;
    }

    setLoading(true);
    try {
      const agentIdsToMakePublic = Array.from(selectedAgents);

      // Make batch API call for all agents
      await makeAgentsPublicCall(accessToken, agentIdsToMakePublic);

      toast.success(t("madePublicToast", { count: agentIdsToMakePublic.length, entity }));
      handleClose();
      onSuccess();
    } catch (error) {
      console.error("Error making agents public:", error);
      toast.fromError(t("makePublicFailed", { entity }));
    } finally {
      setLoading(false);
    }
  };

  const renderStep1Content = () => {
    const allAgentsSelected =
      agentHubData.length > 0 && agentHubData.every((agent) => selectedAgents.has(agent.agent_id || agent.name));
    const isIndeterminate = selectedAgents.size > 0 && !allAgentsSelected;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("selectToMakePublicTitle", { entity })}</h3>
          <div className="flex items-center space-x-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={allAgentsSelected}
                indeterminate={isIndeterminate}
                onCheckedChange={(checked) => handleSelectAll(checked === true)}
                disabled={agentHubData.length === 0}
              />
              {agentHubData.length > 0 ? t("selectAllLabel", { count: agentHubData.length }) : t("selectAllLabel", { count: 0 })}
            </label>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{t("selectPublicDescription", { entity })}</p>

        <div className="max-h-96 overflow-y-auto border rounded-lg p-4">
          <div className="space-y-3">
            {agentHubData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{t("noEntitiesAvailable", { entity })}</p>
              </div>
            ) : (
              agentHubData.map((agent) => {
                const agentId = agent.agent_id || agent.name;
                return (
                  <div key={agentId} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent">
                    <Checkbox
                      checked={selectedAgents.has(agentId)}
                      onCheckedChange={(checked) => handleAgentSelection(agentId, checked === true)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium break-words">{agent.name}</p>
                        <Badge variant="secondary">v{agent.version}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 break-words">{agent.description}</p>
                      {agent.skills && agent.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {agent.skills.slice(0, 3).map((skill) => (
                            <Badge key={skill.id} variant="outline">
                              {skill.name}
                            </Badge>
                          ))}
                          {agent.skills.length > 3 && (
                            <p className="text-xs text-muted-foreground">{t("moreItems", { count: agent.skills.length - 3 })}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {selectedAgents.size > 0 && (
          <div className="bg-info/10 border border-info/20 rounded-lg p-3">
            <p className="text-sm text-info">{t("selectedCountInfo", { count: selectedAgents.size, entity })}</p>
          </div>
        )}
      </div>
    );
  };

  const renderStep2Content = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t("confirmMakePublicTitle", { entity })}</h3>

        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
          <p className="text-sm text-warning">
            {t.rich("makePublicWarning", { entity, code: (chunks) => <code>{chunks}</code> })}
          </p>
        </div>

        <div className="space-y-3">
          <p className="font-medium">{t("toBeMadePublicLabel", { entity })}</p>
          <div className="max-h-48 overflow-y-auto border rounded-lg p-3">
            <div className="space-y-2">
              {Array.from(selectedAgents).map((agentId) => {
                const agent = agentHubData.find((a) => (a.agent_id || a.name) === agentId);
                return (
                  <div key={agentId} className="flex items-center justify-between p-2 bg-muted rounded-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium break-words">{agent?.name || agentId}</p>
                        {agent && <Badge variant="secondary">v{agent.version}</Badge>}
                      </div>
                      {agent?.description && (
                        <p className="text-xs text-muted-foreground mt-1 break-words">{agent.description}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-info/10 border border-info/20 rounded-lg p-3">
          <p className="text-sm text-info">{t("totalToMakePublicInfo", { count: selectedAgents.size, entity })}</p>
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderStep1Content();
      case 1:
        return renderStep2Content();
      default:
        return null;
    }
  };

  const renderStepButtons = () => {
    return (
      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={currentStep === 0 ? handleClose : handlePrevious}>
          {currentStep === 0 ? t("cancelBtn") : t("previousBtn")}
        </Button>

        <div className="flex space-x-2">
          {currentStep === 0 && (
            <Button onClick={handleNext} disabled={selectedAgents.size === 0}>
              {t("nextBtn")}
            </Button>
          )}

          {currentStep === 1 && (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {t("makePublicBtn")}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={visible} onOpenChange={(open) => !open && handleClose()} disablePointerDismissal>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[1200px]">
        <DialogHeader>
          <DialogTitle>{t("makePublicTitle", { entity })}</DialogTitle>
        </DialogHeader>

        <div>
          <ol className="mb-6 flex items-center gap-6">
            {STEP_TITLE_KEYS.map((titleKey, index) => (
              <li
                key={titleKey}
                className="flex items-center gap-2"
                aria-current={currentStep === index ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border text-xs",
                    currentStep === index
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {index + 1}
                </span>
                <span className={cn("text-sm", currentStep === index ? "font-medium" : "text-muted-foreground")}>
                  {t(titleKey, { entity })}
                </span>
              </li>
            ))}
          </ol>

          {renderStepContent()}
          {renderStepButtons()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MakeAgentPublicForm;
