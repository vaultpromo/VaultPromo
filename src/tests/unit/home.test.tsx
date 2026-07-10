import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the platform name", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: /VaultPromo/i })).toBeInTheDocument();
  });

  it("renders get started link pointing to /login", () => {
    render(<HomePage />);
    const link = screen.getByRole("link", { name: /get started/i });
    expect(link).toHaveAttribute("href", "/login");
  });
});
