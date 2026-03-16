import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AuthScreen from "./AuthScreen";

describe("AuthScreen", () => {
  const noop = vi.fn().mockResolvedValue(undefined);

  function getSubmitButton(name: string): HTMLElement {
    const buttons = screen.getAllByRole("button", { name });
    const submit = buttons.find((btn) => btn.getAttribute("type") === "submit");
    return submit ?? buttons[buttons.length - 1];
  }

  it("renders login form with email and password fields", () => {
    render(<AuthScreen onSignIn={noop} onSignUp={noop} />);

    expect(screen.getByPlaceholderText("Email")).toBeDefined();
    expect(screen.getByPlaceholderText("Password")).toBeDefined();
    expect(getSubmitButton("Login")).toBeDefined();
  });

  it("switches to signup mode when Sign Up tab is clicked", () => {
    render(<AuthScreen onSignIn={noop} onSignUp={noop} />);

    // Click the tab (type="button") Sign Up button
    const tabs = screen.getAllByRole("button", { name: "Sign Up" });
    fireEvent.click(tabs[0]);

    // Now both the tab and the submit button should say "Sign Up"
    const allSignUp = screen.getAllByRole("button", { name: "Sign Up" });
    expect(allSignUp.length).toBe(2);
  });

  it("displays error messages", async () => {
    const failSignIn = vi.fn().mockRejectedValue(new Error("Invalid credentials"));

    render(<AuthScreen onSignIn={failSignIn} onSignUp={noop} />);

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "password123" },
    });

    fireEvent.click(getSubmitButton("Login"));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Invalid credentials");
  });
});
