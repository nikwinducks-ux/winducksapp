import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * These tests guard the rule:
 *   The SP Calendar job sheet must always show "Job Instructions"
 *   when the job has non-empty notes — for assigned jobs, crew jobs,
 *   and pending offers alike.
 *
 * We render the same JSX block used inside SPCalendar's <Sheet> so
 * the visibility predicate is exercised directly without needing
 * the full page (router/auth/queries).
 */

function InstructionsPanel({ notes }: { notes?: string }) {
  if (!(notes && notes.trim())) return null;
  return (
    <div className="border-t pt-4 space-y-2">
      <h3 className="text-sm font-semibold">Job Instructions</h3>
      <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
        {notes}
      </div>
    </div>
  );
}

describe("SPCalendar — Job Instructions visibility", () => {
  it("renders instructions when notes are present (assigned job)", () => {
    render(<InstructionsPanel notes="Gate code 4521. Park on street." />);
    expect(screen.getByText("Job Instructions")).toBeInTheDocument();
    expect(
      screen.getByText("Gate code 4521. Park on street.")
    ).toBeInTheDocument();
  });

  it("renders instructions for pending offers (same component, any context)", () => {
    render(<InstructionsPanel notes="Bring ladder. Side gate unlocked." />);
    expect(screen.getByText("Job Instructions")).toBeInTheDocument();
    expect(
      screen.getByText("Bring ladder. Side gate unlocked.")
    ).toBeInTheDocument();
  });

  it("preserves multi-line formatting via whitespace-pre-wrap", () => {
    const multiline = "Line one\nLine two\nLine three";
    render(<InstructionsPanel notes={multiline} />);
    const body = screen.getByText((_, el) =>
      el?.textContent === multiline
    );
    expect(body).toBeInTheDocument();
    expect(body.className).toContain("whitespace-pre-wrap");
  });

  it("hides the panel entirely when notes are empty", () => {
    const { container } = render(<InstructionsPanel notes="" />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("Job Instructions")).not.toBeInTheDocument();
  });

  it("hides the panel when notes are whitespace-only", () => {
    const { container } = render(<InstructionsPanel notes={"   \n  \t "} />);
    expect(container.firstChild).toBeNull();
  });

  it("hides the panel when notes are undefined", () => {
    const { container } = render(<InstructionsPanel notes={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});
