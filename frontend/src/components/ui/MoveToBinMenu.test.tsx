import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MoveToBinMenu } from "./MoveToBinMenu";

describe("MoveToBinMenu", () => {
  it("reveals the bin action in the overflow menu and invokes it", async () => {
    const user = userEvent.setup();
    const onMoveToBin = vi.fn();
    render(
      <MoveToBinMenu
        itemLabel="project Customer onboarding"
        onMoveToBin={onMoveToBin}
      />,
    );

    expect(screen.queryByRole("button", { name: "Move to bin" })).toBeNull();

    await user.click(
      screen.getByRole("button", {
        name: "More actions for project Customer onboarding",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Move to bin" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Move to bin" }));

    expect(onMoveToBin).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", {
        name: "More actions for project Customer onboarding",
      }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("disables the bin action while a request is pending", async () => {
    const user = userEvent.setup();
    render(
      <MoveToBinMenu
        disabled
        itemLabel="document brief.pdf"
        onMoveToBin={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "More actions for document brief.pdf",
      }),
    );

    expect(
      screen.getByRole("button", { name: "Move to bin" }),
    ).toBeDisabled();
  });
});
