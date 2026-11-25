import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("matches the AIVA landing content and links to the right sections", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Welcome to AIVA",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Your AI Business Analyst Agent",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Everything You Need for Smarter Business Analysis",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Trusted by forward-thinking teams",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Get Started" })[0],
    ).toHaveAttribute("href", "/register");
    expect(
      screen.getByRole("link", { name: "Explore Features" }),
    ).toHaveAttribute("href", "#features");
    expect(screen.getByRole("link", { name: "Learn More" })).toHaveAttribute(
      "href",
      "#about",
    );

    for (const [label, target] of [
      ["Home", "#home"],
      ["About", "#about"],
      ["Features", "#features"],
      ["How It Works", "#how-it-works"],
      ["Benefits", "#benefits"],
      ["Testimonials", "#testimonials"],
    ]) {
      expect(
        screen.getByRole("link", { name: new RegExp(`^${label}$`) }),
      ).toHaveAttribute("href", target);
      expect(document.getElementById(target.slice(1))).toBeInTheDocument();
    }

    expect(
      document.querySelector('footer a[href="/login"]'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /^About$/ }));
    expect(document.querySelector(".landing-ref__main")).toHaveAttribute(
      "data-screen",
      "about",
    );
    expect(
      screen.getByRole("heading", {
        name: "Business analysis, made clear and connected.",
      }),
    ).toBeVisible();
  });

  it("supports mobile navigation and persists the theme toggle", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    const menuButton = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(menuButton);
    expect(
      screen.getByRole("button", { name: "Close navigation" }),
    ).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("link", { name: "Features" }));
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(document.querySelector(".landing-ref__main")).toHaveAttribute(
      "data-screen",
      "features",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    );
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem("clarity-theme")).toBe("dark");
  });
});
