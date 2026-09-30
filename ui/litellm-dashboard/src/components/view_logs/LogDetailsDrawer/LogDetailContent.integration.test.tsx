import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GuardrailJumpLink, LogDetailContent } from "./LogDetailContent";
import type { LogEntry } from "../columns";

vi.mock("../GuardrailViewer/GuardrailViewer", () => ({
  default: ({ data }: { data: unknown }) => <div data-testid="guardrail-viewer">{JSON.stringify(data)}</div>,
}));

const createLogEntry = (overrides: Partial<LogEntry> = {}): LogEntry =>
  ({
    request_id: "chatcmpl-test-id",
    api_key: "api-key",
    team_id: "team-id",
    model: "gpt-4",
    model_id: "gpt-4",
    call_type: "chat",
    spend: 0,
    total_tokens: 10,
    prompt_tokens: 5,
    completion_tokens: 5,
    startTime: "2025-11-14T00:00:00Z",
    endTime: "2025-11-14T00:00:01Z",
    cache_hit: "miss",
    request_duration_ms: 1000,
    messages: [{ role: "user", content: "hello" }],
    response: { choices: [{ message: { content: "hi" } }] },
    metadata: { status: "success" },
    request_tags: {},
    custom_llm_provider: "openai",
    api_base: "https://api.example.com",
    ...overrides,
  }) as LogEntry;

describe("LogDetailContent", () => {
  it("should render the component successfully", () => {
    render(<LogDetailContent logEntry={createLogEntry()} />);

    expect(screen.getByText("请求详情")).toBeInTheDocument();
  });

  it("should display Request Details with model, provider, and call type", () => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          model: "gpt-4o",
          custom_llm_provider: "anthropic",
          call_type: "completion",
        })}
      />,
    );

    expect(screen.getByText("gpt-4o")).toBeInTheDocument();
    expect(screen.getByText("anthropic")).toBeInTheDocument();
    expect(screen.getByText("completion")).toBeInTheDocument();
  });

  it("should display error alert when request has failed", () => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          metadata: {
            status: "failure",
            error_information: {
              error_code: "rate_limit",
              error_message: "Too many requests",
              error_class: "RateLimitError",
            },
          },
        })}
      />,
    );

    expect(screen.getByText("请求失败")).toBeInTheDocument();
    expect(screen.getByText("rate_limit")).toBeInTheDocument();
    expect(screen.getByText("Too many requests")).toBeInTheDocument();
  });

  it("should display tags section when request_tags has entries", () => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          request_tags: { env: "prod", version: "1.0" },
        })}
      />,
    );

    expect(screen.getByText("标签")).toBeInTheDocument();
    expect(screen.getByText("env: prod")).toBeInTheDocument();
    expect(screen.getByText("version: 1.0")).toBeInTheDocument();
  });

  it("should not display tags section when request_tags is empty", () => {
    render(<LogDetailContent logEntry={createLogEntry({ request_tags: {} })} />);

    expect(screen.queryByText("标签")).not.toBeInTheDocument();
  });

  it("should display Metrics section with tokens and cost", () => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          spend: 0.002,
        })}
      />,
    );

    expect(screen.getByText("指标")).toBeInTheDocument();
    expect(screen.getAllByText("$0.00200000").length).toBeGreaterThanOrEqual(1);
  });

  it("shows reasoning tokens in Metrics when the usage breakout carries them", () => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          metadata: {
            status: "success",
            usage_object: { completion_tokens_details: { text_tokens: 32, reasoning_tokens: 224 } },
          },
        })}
      />,
    );

    expect(screen.getByText("推理 token")).toBeInTheDocument();
    expect(screen.getByText("224")).toBeInTheDocument();
  });

  it("hides the reasoning metric when the breakout is absent or zero", () => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          metadata: {
            status: "success",
            usage_object: { completion_tokens_details: { text_tokens: 32, reasoning_tokens: 0 } },
          },
        })}
      />,
    );

    expect(screen.queryByText("推理 token")).not.toBeInTheDocument();
  });

  describe("Batch Results section", () => {
    const batchCostEntry = (metadata: Record<string, unknown>) =>
      createLogEntry({
        request_id: "batch_abc123_batch_cost",
        call_type: "aretrieve_batch",
        metadata: { status: "success", ...metadata },
      });

    it("renders batch id, per-request outcome counts, and batch models for a batch cost row", () => {
      render(
        <LogDetailContent
          logEntry={batchCostEntry({
            batch_models: ["gemini-2.5-flash"],
            batch_successful_requests: 2,
            batch_failed_requests: 1,
          })}
        />,
      );

      expect(screen.getByText("批量结果")).toBeInTheDocument();
      expect(screen.getByText("batch_abc123")).toBeInTheDocument();
      expect(screen.getByText("成功请求")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("失败请求")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("gemini-2.5-flash")).toBeInTheDocument();
    });

    it("still renders the batch id when a legacy row carries no counts", () => {
      render(<LogDetailContent logEntry={batchCostEntry({})} />);

      expect(screen.getByText("批量结果")).toBeInTheDocument();
      expect(screen.getByText("batch_abc123")).toBeInTheDocument();
      expect(screen.queryByText("成功请求")).not.toBeInTheDocument();
    });

    it("never renders for a non-batch call type", () => {
      render(
        <LogDetailContent
          logEntry={createLogEntry({
            metadata: { status: "success", batch_successful_requests: 2, batch_failed_requests: 1 },
          })}
        />,
      );

      expect(screen.queryByText("批量结果")).not.toBeInTheDocument();
    });
  });

  it("should show Input Tokens and Output Tokens for anthropic_messages when uncached text_tokens exist", () => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          call_type: "anthropic_messages",
          prompt_tokens: 34548,
          completion_tokens: 28,
          total_tokens: 34576,
          spend: 0.01107885,
          metadata: {
            status: "success",
            additional_usage_values: {
              prompt_tokens_details: { text_tokens: 3 },
              cache_read_input_tokens: 34462,
              cache_creation_input_tokens: 83,
            },
          },
        })}
      />,
    );

    expect(screen.getByText("输入 token")).toBeInTheDocument();
    expect(screen.getByText("输出 token")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("28")).toBeInTheDocument();
    // Combined TokenFlow line should not appear (would include "prompt tokens")
    expect(screen.queryByText(/输入 \d+ \+ 输出 \d+/)).not.toBeInTheDocument();
  });

  it("should display ConfigInfoMessage when no messages, response, or error and not loading", () => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          messages: [],
          response: {},
          metadata: {},
        })}
      />,
    );

    expect(screen.getByText("无法显示请求日志配置")).toBeInTheDocument();
  });

  it("should not display ConfigInfoMessage when isLoadingDetails is true even without data", () => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          messages: [],
          response: {},
          metadata: {},
        })}
        isLoadingDetails={true}
      />,
    );

    expect(screen.queryByText("无法显示请求日志配置")).not.toBeInTheDocument();
  });

  it("should display loading state when isLoadingDetails is true", () => {
    render(<LogDetailContent logEntry={createLogEntry()} isLoadingDetails={true} />);

    expect(screen.getByText("正在加载请求与响应数据…")).toBeInTheDocument();
  });

  it("should switch the Request & Response body between the Pretty and JSON view modes", async () => {
    const user = userEvent.setup();
    render(<LogDetailContent logEntry={createLogEntry()} />);

    expect(screen.getByText("请求与响应")).toBeInTheDocument();
    expect(screen.getByText("美化")).toBeInTheDocument();
    expect(screen.getByText("JSON")).toBeInTheDocument();

    await user.click(screen.getByText("JSON"));
    expect(screen.getByRole("tab", { name: "请求" })).toBeInTheDocument();

    await user.click(screen.getByText("美化"));
    expect(screen.queryByRole("tab", { name: "请求" })).not.toBeInTheDocument();
  });

  it.each(["object", "serialized", "messages only", "null captures"])(
    "preserves request inspection and copying for classifier logs with %s data",
    async (shape) => {
      const user = userEvent.setup();
      const messages = [{ role: "user", content: "legacy classifier prompt" }];
      const request = {
        messages,
        temperature: 0.5,
        ...(shape === "null captures" ? { classifier_input: null, originating_request_masked: null } : {}),
      };
      const storedRequest = shape === "serialized" ? JSON.stringify(request) : request;
      const logEntry: Partial<LogEntry> = {
        call_type: "acompletion",
        messages,
        proxy_server_request: shape === "messages only" ? undefined : storedRequest,
        metadata: { status: "success", internal_call_origin: "autorouter_classifier" },
      };
      render(<LogDetailContent logEntry={createLogEntry(logEntry)} />);

      expect(screen.getByText("legacy classifier prompt")).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "分类器输入" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("tab", { name: "JSON", exact: true }));
      await user.click(screen.getByRole("button", { name: "复制 JSON", exact: true }));
      expect(await navigator.clipboard.readText()).toBe(
        JSON.stringify(shape === "messages only" ? messages : request, null, 2),
      );
    },
  );

  it.each([
    ["classifier_input", "acompletion"],
    ["originating_request_masked", "acompletion"],
    ["classifier_input", "aresponses"],
    ["originating_request_masked", "responses"],
  ])("shows partial classifier audits when only %s is captured for %s", (field, callType) => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          call_type: callType,
          proxy_server_request: JSON.stringify({
            [field]: { messages: [{ role: "user", content: "captured prompt" }] },
          }),
          metadata: { status: "success", internal_call_origin: "autorouter_classifier" },
        })}
      />,
    );

    expect(screen.getByRole("region", { name: "分类器输入" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "原始请求（凭据已脱敏）" })).toBeInTheDocument();
    expect(screen.getByText("未捕获或未开启消息日志")).toBeInTheDocument();
    expect(screen.queryByText("请求与响应")).not.toBeInTheDocument();
  });

  it("should display Request and Response tabs when JSON view is selected", async () => {
    const user = userEvent.setup();
    render(<LogDetailContent logEntry={createLogEntry()} />);

    await user.click(screen.getByText("JSON"));

    expect(screen.getByRole("tab", { name: "请求" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "响应" })).toBeInTheDocument();
  });

  it("should display response not available message when no response and Response tab is selected", async () => {
    const user = userEvent.setup();
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          response: {},
          metadata: { status: "success" },
        })}
      />,
    );

    await user.click(screen.getByText("JSON"));
    await user.click(screen.getByRole("tab", { name: "响应" }));

    expect(screen.getByText("响应数据不可用")).toBeInTheDocument();
  });

  it("should display Metadata section when metadata has keys", () => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          metadata: { status: "success", custom_key: "value" },
        })}
      />,
    );

    expect(screen.getByText("元数据")).toBeInTheDocument();
  });

  it("should display IP address when requester_ip_address is present", () => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          requester_ip_address: "192.168.1.1",
        })}
      />,
    );

    expect(screen.getByText("192.168.1.1")).toBeInTheDocument();
  });

  it("should display guardrail label when guardrail data exists", () => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          metadata: {
            status: "success",
            guardrail_information: {
              guardrail_name: "PII Filter",
              masked_entity_count: { PERSON: 2 },
            },
          },
        })}
      />,
    );

    expect(screen.getByText("PII Filter")).toBeInTheDocument();
    expect(screen.getByText("2 项已脱敏")).toBeInTheDocument();
  });

  it("should display a Response Cache 'Hit' tag when the response cache served the request", () => {
    render(<LogDetailContent logEntry={createLogEntry({ cache_hit: "True" })} />);

    expect(screen.getByText("响应缓存")).toBeInTheDocument();
    expect(screen.getByText("命中")).toBeInTheDocument();
  });

  it("should show prompt cache tokens and no response-cache hit when only provider prompt caching occurred", () => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          cache_hit: "False",
          metadata: {
            status: "success",
            additional_usage_values: {
              cache_read_input_tokens: 34462,
              cache_creation_input_tokens: 83,
            },
          },
        })}
      />,
    );

    expect(screen.getByText("提示词缓存读取 token")).toBeInTheDocument();
    expect(screen.getByText("34,462")).toBeInTheDocument();
    expect(screen.getByText("提示词缓存写入 token")).toBeInTheDocument();
    expect(screen.getByText("83")).toBeInTheDocument();
    expect(screen.getByText("未命中")).toBeInTheDocument();
    expect(screen.queryByText("命中")).not.toBeInTheDocument();
  });

  it("should display Prompt Cache Creation Tokens even when there are no cache read tokens", () => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          cache_hit: "None",
          metadata: {
            status: "success",
            additional_usage_values: {
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 83,
            },
          },
        })}
      />,
    );

    expect(screen.getByText("提示词缓存写入 token")).toBeInTheDocument();
    expect(screen.getByText("83")).toBeInTheDocument();
  });

  it("should link the Response Cache tooltip to the response caching docs", async () => {
    const user = userEvent.setup();
    render(<LogDetailContent logEntry={createLogEntry({ cache_hit: "True" })} />);

    expect(screen.getByText("响应缓存")).toBeInTheDocument();
    const infoIcons = screen.getAllByRole("img", { name: /说明/ });
    expect(infoIcons).toHaveLength(1);
    await user.hover(infoIcons[0]);

    expect(await screen.findByRole("link", { name: "文档" })).toHaveAttribute(
      "href",
      "https://docs.litellm.ai/docs/proxy/caching",
    );
  });

  it("should link the prompt cache tooltips to the prompt caching docs", async () => {
    const user = userEvent.setup();
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          cache_hit: "None",
          metadata: {
            status: "success",
            additional_usage_values: { cache_read_input_tokens: 100 },
          },
        })}
      />,
    );

    expect(screen.getByText("提示词缓存读取 token")).toBeInTheDocument();
    const infoIcons = screen.getAllByRole("img", { name: /说明/ });
    expect(infoIcons).toHaveLength(1);
    await user.hover(infoIcons[0]);

    expect(await screen.findByRole("link", { name: "文档" })).toHaveAttribute(
      "href",
      "https://docs.litellm.ai/docs/completion/prompt_caching",
    );
  });

  it("should hide the Response Cache row when cache_hit is not a true/false value", () => {
    render(<LogDetailContent logEntry={createLogEntry({ cache_hit: "None" })} />);

    expect(screen.queryByText("响应缓存")).not.toBeInTheDocument();
  });

  it("should display the Cache Key next to the Response Cache result", () => {
    render(<LogDetailContent logEntry={createLogEntry({ cache_hit: "True", cache_key: "abc123cachekey" })} />);

    expect(screen.getByText("缓存键")).toBeInTheDocument();
    expect(screen.getByText("abc123cachekey")).toBeInTheDocument();
  });

  it("should display a cache miss and Cache Key for the request that populates the response cache", () => {
    render(<LogDetailContent logEntry={createLogEntry({ cache_hit: "None", cache_key: "abc123cachekey" })} />);

    expect(screen.getByText("响应缓存")).toBeInTheDocument();
    expect(screen.getByText("未命中")).toBeInTheDocument();
    expect(screen.getByText("缓存键")).toBeInTheDocument();
    expect(screen.getByText("abc123cachekey")).toBeInTheDocument();
  });

  it("should hide the Cache Key row when caching is off", () => {
    render(<LogDetailContent logEntry={createLogEntry({ cache_hit: "False", cache_key: "Cache OFF" })} />);

    expect(screen.getByText("响应缓存")).toBeInTheDocument();
    expect(screen.queryByText("缓存键")).not.toBeInTheDocument();
  });

  it("should hide response cache metadata when caching is off and cache_hit is None", () => {
    render(<LogDetailContent logEntry={createLogEntry({ cache_hit: "None", cache_key: "Cache OFF" })} />);

    expect(screen.queryByText("响应缓存")).not.toBeInTheDocument();
    expect(screen.queryByText("缓存键")).not.toBeInTheDocument();
  });

  it("should display LiteLLM Overhead when litellm_overhead_time_ms is in metadata", () => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          metadata: {
            status: "success",
            litellm_overhead_time_ms: 42.5,
          },
        })}
      />,
    );

    expect(screen.getByText("LiteLLM 开销")).toBeInTheDocument();
    expect(screen.getByText("42.50 ms")).toBeInTheDocument();
  });

  it("should not display LiteLLM Overhead when litellm_overhead_time_ms is absent from metadata", () => {
    render(<LogDetailContent logEntry={createLogEntry({ metadata: { status: "success" } })} />);

    expect(screen.queryByText("LiteLLM 开销")).not.toBeInTheDocument();
  });

  const retriesItem = () => screen.getByText("重试").parentElement as HTMLElement;

  it("should display attempted_retries / max_retries for Retries when attempted_retries > 0", () => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({ metadata: { status: "success", attempted_retries: 2, max_retries: 3 } })}
      />,
    );

    expect(within(retriesItem()).getByText("2 / 3")).toBeInTheDocument();
  });

  it("should display a 'None' tag for Retries when attempted_retries is 0", () => {
    render(<LogDetailContent logEntry={createLogEntry({ metadata: { status: "success", attempted_retries: 0 } })} />);

    expect(within(retriesItem()).getByText("无")).toBeInTheDocument();
  });

  it("should display '-' for Retries when attempted_retries is absent from metadata", () => {
    render(<LogDetailContent logEntry={createLogEntry({ metadata: { status: "success" } })} />);

    expect(within(retriesItem()).getByText("-")).toBeInTheDocument();
  });

  it("should display start and end time in ISO format", () => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          startTime: "2025-11-14T12:00:00.000Z",
          endTime: "2025-11-14T12:00:01.500Z",
        })}
      />,
    );

    expect(screen.getByText("开始时间")).toBeInTheDocument();
    expect(screen.getByText("结束时间")).toBeInTheDocument();
    const dateElements = screen.getAllByText((content) => content.includes("2025-11-14"));
    expect(dateElements.length).toBeGreaterThanOrEqual(2);
  });

  it("should display Vector Store Requests when vector store data exists", () => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          metadata: {
            status: "success",
            vector_store_request_metadata: [
              {
                query: "test query",
                vector_store_id: "vs-123",
                custom_llm_provider: "openai",
                start_time: 1700000000,
                end_time: 1700000001,
                vector_store_search_response: { data: [], search_query: "test" },
              },
            ],
          },
        })}
      />,
    );

    expect(screen.getByText("向量存储请求")).toBeInTheDocument();
  });

  it("should display provider as dash when custom_llm_provider is absent", () => {
    render(
      <LogDetailContent
        logEntry={createLogEntry({
          custom_llm_provider: undefined,
        })}
      />,
    );

    const descriptions = screen.getByText("提供商").parentElement as HTMLElement;
    expect(descriptions).toBeInTheDocument();
    expect(within(descriptions).getByText("-")).toBeInTheDocument();
  });
});

describe("GuardrailJumpLink", () => {
  it.each([
    [["success", "success"], "text-success", "\u2713"],
    [["success", "guardrail_flagged"], "text-warning", "\u26A0"],
    [["guardrail_flagged", "guardrail_intervened"], "text-destructive", "\u2717"],
  ])("styles %j as %s", (statuses, expectedClass, glyph) => {
    render(<GuardrailJumpLink guardrailEntries={statuses.map((s) => ({ guardrail_status: s }))} />);

    const pill = screen.getByText(/已评估 2 个护栏/);
    expect(pill).toHaveClass(expectedClass);
    expect(pill).toHaveTextContent(glyph);
  });
});
