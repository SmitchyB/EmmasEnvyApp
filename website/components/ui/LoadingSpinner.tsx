export function LoadingSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-white/85">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
