import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocale } from "next-intl";
import { beforeEach, describe, expect, it } from "vitest";

import { LOCALE_STORAGE_KEY } from "./config";
import { LocaleProvider, useLocaleState } from "./LocaleProvider";

// useLocale reads the real NextIntlClientProvider context (the global test mock keeps it
// actual), so asserting it proves the provider really feeds the chosen locale to next-intl.
const LocaleProbe = () => {
  const { locale, setLocale } = useLocaleState();
  const intlLocale = useLocale();
  return (
    <div>
      <span data-testid="state-locale">{locale}</span>
      <span data-testid="intl-locale">{intlLocale}</span>
      <button type="button" onClick={() => setLocale("en")}>
        switch
      </button>
    </div>
  );
};

describe("LocaleProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to zh-CN and feeds it to next-intl", () => {
    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(screen.getByTestId("state-locale")).toHaveTextContent("zh-CN");
    expect(screen.getByTestId("intl-locale")).toHaveTextContent("zh-CN");
  });

  it("adopts a stored locale after mount", async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "en");

    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(await screen.findByText("en", { selector: '[data-testid="intl-locale"]' })).toBeInTheDocument();
    expect(screen.getByTestId("state-locale")).toHaveTextContent("en");
  });

  it("ignores a stored value that is not a supported locale", async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "fr");

    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(screen.getByTestId("state-locale")).toHaveTextContent("zh-CN");
  });

  it("persists a locale switch and updates next-intl", async () => {
    const user = userEvent.setup();

    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    );

    await user.click(screen.getByRole("button", { name: "switch" }));

    expect(screen.getByTestId("state-locale")).toHaveTextContent("en");
    expect(screen.getByTestId("intl-locale")).toHaveTextContent("en");
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en");
  });
});
