"use client";

import { Waypoints } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cva.config";

type Translator = (key: string, values?: Record<string, string | number>) => string;

export interface RoutingDecisionTierBoundaries {
  simple_medium?: number;
  medium_complex?: number;
  complex_reasoning?: number;
}

export interface RoutingDecision {
  router_model_name?: string;
  router_type?: string;
  routed_model?: string;
  cause?: string;
  tier?: string;
  tier_label?: string;
  request_type?: string;
  score?: number;
  signals?: string[];
  matched_keyword?: string;
  escalation_keyword?: string;
  classifier_model?: string;
  escalated?: boolean;
  tier_boundaries?: RoutingDecisionTierBoundaries;
  reasoning_override_min_score?: number;
}

const ROUTER_TYPE_LABEL_KEYS: Record<string, string> = {
  complexity: "routerTypeAutoRouterV2",
  adaptive: "routerTypeAdaptive",
  quality: "routerTypeQuality",
};

/**
 * The tier the score alone would have produced, given the boundaries in effect when
 * the decision was made. Rendered as the bracket that explains a score, so it must
 * use the snapshot rather than today's config.
 */
function describeScoreAgainstBoundaries(
  t: Translator,
  score: number,
  boundaries?: RoutingDecisionTierBoundaries,
  renamed?: boolean,
): string | null {
  if (!boundaries) return null;
  const {
    simple_medium: simpleMedium,
    medium_complex: mediumComplex,
    complex_reasoning: complexReasoning,
  } = boundaries;
  if (simpleMedium === undefined || mediumComplex === undefined || complexReasoning === undefined) return null;

  const named = (range: string, tier: string): string => (renamed ? range : t("scoreWithTier", { range, tier }));
  if (score < simpleMedium) return named(t("scoreBelow", { bound: simpleMedium }), "SIMPLE");
  if (score < mediumComplex) return named(t("scoreBetween", { low: simpleMedium, high: mediumComplex }), "MEDIUM");
  if (score < complexReasoning) return named(t("scoreBetween", { low: mediumComplex, high: complexReasoning }), "COMPLEX");
  return named(t("scoreAtOrAbove", { bound: complexReasoning }), "REASONING");
}

function describePlanModeFloor(t: Translator, matchedKeyword: string | undefined): string {
  if (matchedKeyword === "exit_plan_mode") return t("planModeFloorTool");
  if (matchedKeyword) return t("planModeFloorKeyword", { keyword: matchedKeyword });
  return t("planModeFloor");
}

/**
 * The sentinel is the whole reason this row is worth reading: it is the string an operator
 * would add to housekeeping_patterns to cover another client, so naming it turns the row into
 * the instruction. Without it the drawer says only that the classifier was skipped.
 */
function describeHousekeeping(t: Translator, matchedKeyword: string | undefined): string {
  if (matchedKeyword) return t("housekeepingKeyword", { keyword: matchedKeyword });
  return t("housekeepingPlain");
}

/** Rows logged before the floor was recorded name what it tracked back then instead of a number. */
function describeReasoningOverride(t: Translator, tierLabel: string | undefined, floor: number | undefined): string {
  const stated = floor === undefined ? t("simpleToMediumBoundary") : String(floor);
  return t("reasoningOverride", { tier: tierLabel ?? "REASONING", floor: stated });
}

const CONSTANT_CAUSE_LABEL_KEYS: Record<string, string> = {
  heuristic_scorer: "causeHeuristicScorer",
  heuristic_v2: "causeHeuristicV2",
  heuristic_first_short_circuit: "causeHeuristicFirstShortCircuit",
  hybrid_short_circuit: "causeHybridShortCircuit",
  classifier_plugin: "causeClassifierPlugin",
  semantic_keyword_match: "causeSemanticKeywordMatch",
  session_affinity_pin: "causeSessionAffinityPin",
  session_affinity_escalation: "causeSessionAffinityEscalation",
  user_turn_continuation: "causeUserTurnContinuation",
  modality_escalation: "causeModalityEscalation",
  modality_pin_override: "causeModalityPinOverride",
  quality_tier: "causeQualityTier",
  bandit: "causeBandit",
  default_fallback: "causeDefaultFallback",
  classifier_fallback: "causeClassifierFallback",
  default_model_fallback: "causeDefaultModelFallback",
};

function describeCause(t: Translator, decision: RoutingDecision): string {
  const {
    cause,
    classifier_model: classifierModel,
    matched_keyword: matchedKeyword,
    tier_label: tierLabel,
    reasoning_override_min_score: overrideFloor,
  } = decision;

  const constantKey = cause ? CONSTANT_CAUSE_LABEL_KEYS[cause] : undefined;
  if (constantKey) return t(constantKey);

  switch (cause) {
    case "reasoning_override":
      return describeReasoningOverride(t, tierLabel, overrideFloor);
    case "llm_classifier":
      return classifierModel ? t("llmClassifierWithModel", { model: classifierModel }) : t("llmClassifier");
    case "literal_keyword_match":
    case "keyword":
      return matchedKeyword ? t("keywordMatchWith", { keyword: matchedKeyword }) : t("keywordMatch");
    case "plan_mode":
      return describePlanModeFloor(t, matchedKeyword);
    case "housekeeping":
      return describeHousekeeping(t, matchedKeyword);
    default:
      return cause ?? t("causeUnknown");
  }
}

/**
 * A request can ask to escalate and get nowhere, when its tier is already the highest
 * one configured. That row still has to say the caller asked, otherwise it reads as an
 * ordinary route; it just must not claim a bump that did not happen. Only called when
 * the request escalated or asked to, so there is no "did not escalate" case.
 */
function describeEscalation(t: Translator, escalated: boolean, keyword: string | undefined): string {
  if (escalated) return keyword ? t("escalationYesKeyword", { keyword }) : t("escalationYes");
  return keyword ? t("escalationRequestedKeyword", { keyword }) : t("escalationRequested");
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1 text-sm">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

export function RoutingDecisionCard({
  decision,
  className,
}: {
  decision?: RoutingDecision | null;
  className?: string;
}) {
  const t = useTranslations("logs");
  if (!decision || !decision.cause) return null;

  const {
    router_model_name: routerModelName,
    router_type: routerType,
    routed_model: routedModel,
    tier,
    tier_label: tierLabel,
    request_type: requestType,
    score,
    signals,
    escalated,
    escalation_keyword: escalationKeyword,
    tier_boundaries: tierBoundaries,
  } = decision;

  // On an override row the score did not decide the tier, so showing it against a
  // boundary would claim something untrue. Keyed off the cause rather than a marker
  // inside `signals`, which redaction can remove.
  const scoreExplanation =
    score !== undefined && decision.cause !== "reasoning_override" && decision.cause !== "plan_mode"
      ? describeScoreAgainstBoundaries(t, score, tierBoundaries, tierLabel !== undefined)
      : null;

  return (
    <div className={cn("mb-6 w-full max-w-full overflow-hidden rounded-lg bg-card shadow-sm", className)}>
      <div className="border-b px-4 py-2.5 text-sm font-medium">{t("routingTitle")}</div>
      <div className="px-4 py-3">
        {routerModelName && (
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Waypoints size={14} aria-hidden />
            <span>{routerModelName}</span>
            {routerType && (
              <span className="font-normal text-muted-foreground">
                ({routerType in ROUTER_TYPE_LABEL_KEYS ? t(ROUTER_TYPE_LABEL_KEYS[routerType]) : routerType})
              </span>
            )}
          </div>
        )}

        {tier && (
          <Row label={t("labelTier")}>
            <Badge variant="secondary" className="font-normal">
              {tierLabel ?? tier}
            </Badge>
          </Row>
        )}

        {requestType && <Row label={t("labelRequestType")}>{requestType}</Row>}

        <Row label={t("labelDecidedBy")}>{describeCause(t, decision)}</Row>

        {score !== undefined && (
          <Row label={t("labelScore")}>
            <span className="tabular-nums">{score.toFixed(2)}</span>
            {scoreExplanation && <span className="ml-2 text-muted-foreground">({scoreExplanation})</span>}
          </Row>
        )}

        {routedModel && <Row label={t("labelRoutedTo")}>{routedModel}</Row>}

        {escalated !== undefined && (
          <Row label={t("labelEscalated")}>{describeEscalation(t, escalated, escalationKeyword)}</Row>
        )}

        {signals && signals.length > 0 && (
          <Row label={t("labelSignals")}>
            <span className="flex flex-wrap gap-1">
              {signals.map((signal) => (
                <Badge key={signal} variant="outline" className="font-normal">
                  {signal}
                </Badge>
              ))}
            </span>
          </Row>
        )}
      </div>
    </div>
  );
}

export default RoutingDecisionCard;
