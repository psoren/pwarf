import { useEffect } from "react";
import { TUTORIAL_STEPS, type TutorialStep } from "../hooks/useTutorial";

interface Props {
  stepIndex: number;
  isFirst: boolean;
  isLast: boolean;
  onNext: () => void;
  onPrev: () => void;
  onDismiss: () => void;
}

export function TutorialOverlay({ stepIndex, isFirst, isLast, onNext, onPrev, onDismiss }: Props) {
  const step = TUTORIAL_STEPS[stepIndex];

  // Esc dismisses
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onDismiss();
      }
    }
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Spotlight cutout */}
      {step.spotlight && <SpotlightHole spotlight={step.spotlight} />}

      {/* Tooltip card — pointer-events-auto so buttons work */}
      <TooltipCard
        step={step}
        stepIndex={stepIndex}
        total={TUTORIAL_STEPS.length}
        isFirst={isFirst}
        isLast={isLast}
        onNext={onNext}
        onPrev={onPrev}
        onDismiss={onDismiss}
      />
    </div>
  );
}

function SpotlightHole({ spotlight }: { spotlight: NonNullable<TutorialStep["spotlight"]> }) {
  return (
    <div
      className="absolute rounded-sm"
      style={{
        top: spotlight.top,
        left: spotlight.left,
        width: spotlight.width,
        height: spotlight.height,
        // Punch a transparent hole through the backdrop using mix-blend-mode
        // This div sits on top of the backdrop and clears it
        background: "transparent",
        boxShadow: "none",
        outline: "2px solid var(--amber, #f59e0b)",
        outlineOffset: "-2px",
        // We can't cut through the bg-black/60 backdrop with z-index alone,
        // so instead we render the backdrop behind and draw a bright border around the spotlight.
        zIndex: 1,
      }}
    />
  );
}

function tooltipStyle(anchor: TutorialStep["tooltipAnchor"]): React.CSSProperties {
  switch (anchor) {
    case "center":
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    case "below-top":
      return { top: "44px", left: "50%", transform: "translateX(-50%)" };
    case "right-of-left":
      return { top: "50%", left: "220px", transform: "translateY(-50%)" };
    case "above-bottom":
      return { bottom: "68px", left: "50%", transform: "translateX(-50%)" };
    case "left-of-right":
      return { top: "50%", right: "230px", transform: "translateY(-50%)" };
  }
}

interface CardProps {
  step: TutorialStep;
  stepIndex: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  onNext: () => void;
  onPrev: () => void;
  onDismiss: () => void;
}

function TooltipCard({ step, stepIndex, total, isFirst, isLast, onNext, onPrev, onDismiss }: CardProps) {
  return (
    <div
      className="absolute pointer-events-auto w-80 border border-[var(--amber,#f59e0b)] bg-[var(--bg-panel,#111)] p-4 flex flex-col gap-3 shadow-xl"
      style={{ zIndex: 2, ...tooltipStyle(step.tooltipAnchor) }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-[var(--amber,#f59e0b)] font-bold text-sm leading-snug">{step.title}</h2>
        <button
          onClick={onDismiss}
          className="text-[var(--text,#ccc)] hover:text-[var(--red,#f87171)] cursor-pointer shrink-0 text-base leading-none mt-0.5"
          aria-label="Close tutorial"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <p className="text-[var(--text,#ccc)] text-xs leading-relaxed">{step.body}</p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[var(--border,#444)] text-xs">
          {stepIndex + 1} / {total}
        </span>
        <div className="flex gap-2">
          {!isFirst && (
            <button
              onClick={onPrev}
              className="px-2 py-0.5 border border-[var(--border,#444)] text-[var(--text,#ccc)] hover:border-[var(--amber,#f59e0b)] hover:text-[var(--amber,#f59e0b)] cursor-pointer text-xs"
            >
              Prev
            </button>
          )}
          <button
            onClick={onNext}
            className="px-3 py-0.5 border border-[var(--green,#4ade80)] text-[var(--green,#4ade80)] hover:bg-[var(--green,#4ade80)] hover:text-[var(--bg-panel,#111)] cursor-pointer text-xs font-bold"
          >
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
