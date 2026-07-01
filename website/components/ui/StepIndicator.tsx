export function StepIndicator({
  steps,
  currentStep,
}: {
  steps: readonly string[];
  currentStep: number;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-1">
        {steps.map((_, index) => {
          const done = index < currentStep;
          const active = index === currentStep;
          return (
            <div key={index} className="flex flex-1 items-center gap-1">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${
                  active
                    ? "bg-white text-pink-dark shadow-md"
                    : done
                      ? "bg-white/25 text-white"
                      : "bg-white/10 text-white/50"
                }`}
              >
                {done ? "✓" : index + 1}
              </div>
              {index < steps.length - 1 ? (
                <div
                  className={`h-0.5 flex-1 rounded-full ${done ? "bg-white/40" : "bg-white/15"}`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-white/75">
        Step {currentStep + 1} of {steps.length}:{" "}
        <span className="font-medium text-white">{steps[currentStep]}</span>
      </p>
    </div>
  );
}
