import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("exposes its label and responds to keyboard activation", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button onClick={onClick} type="button">
        Create project
      </Button>,
    );

    await user.tab();
    expect(
      screen.getByRole("button", { name: "Create project" }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledOnce();
  });
});
