type FieldProps = {
  label: string;
  children: React.ReactNode;
};

/** Label + control wrapper shared by every simple text field across the
 * resume section components (contact, education, experience, etc). */
export function Field({ label, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
