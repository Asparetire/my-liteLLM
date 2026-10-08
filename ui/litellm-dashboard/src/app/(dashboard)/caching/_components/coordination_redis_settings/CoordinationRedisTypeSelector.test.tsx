import React from "react";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/../tests/test-utils";
import CoordinationRedisTypeSelector from "./CoordinationRedisTypeSelector";
import { chooseSelectOption } from "../../../../../../tests/test-utils";

describe("CoordinationRedisTypeSelector", () => {
  it("labels the control and shows the current selection", () => {
    renderWithProviders(<CoordinationRedisTypeSelector redisType="node" onTypeChange={vi.fn()} />);

    expect(screen.getByText("Redis 类型")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("单机（单实例）")).toBeInTheDocument();
  });

  it("shows the description for the selected type", () => {
    renderWithProviders(<CoordinationRedisTypeSelector redisType="cluster" onTypeChange={vi.fn()} />);

    expect(screen.getByText("Redis 集群模式，支持高可用与水平扩展")).toBeInTheDocument();
  });

  it("switches the description when the selected type changes", () => {
    const { rerender } = renderWithProviders(<CoordinationRedisTypeSelector redisType="node" onTypeChange={vi.fn()} />);
    expect(screen.getByText("标准 Redis 单节点/单实例")).toBeInTheDocument();

    rerender(<CoordinationRedisTypeSelector redisType="sentinel" onTypeChange={vi.fn()} />);

    expect(screen.getByText("Redis 哨兵模式，支持高可用与自动故障转移")).toBeInTheDocument();
    expect(screen.queryByText("标准 Redis 单节点/单实例")).not.toBeInTheDocument();
  });

  it("reports the newly picked type to the caller", async () => {
    const onTypeChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<CoordinationRedisTypeSelector redisType="node" onTypeChange={onTypeChange} />);

    await chooseSelectOption(user, screen.getByRole("combobox"), "集群");

    expect(onTypeChange).toHaveBeenCalledTimes(1);
    expect(onTypeChange.mock.calls[0][0]).toBe("cluster");
  });

  it("offers every supported coordination redis type", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CoordinationRedisTypeSelector redisType="node" onTypeChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByText("集群")).toBeInTheDocument();
    expect(screen.getByText("哨兵")).toBeInTheDocument();
    expect(screen.getAllByText("单机（单实例）").length).toBeGreaterThan(0);
  });
});
