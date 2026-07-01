"use client";

export function Dropdown<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className = "",
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        const opt = options.find((o) => String(o.value) === raw);
        if (opt) onChange(opt.value);
      }}
      className={`w-full rounded-lg border border-white/25 bg-white/10 px-3 py-2.5 text-white outline-none focus:border-white/50 ${className}`}
    >
      <option value="" disabled className="text-gray-900">
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)} className="text-gray-900">
          {o.label}
        </option>
      ))}
    </select>
  );
}
