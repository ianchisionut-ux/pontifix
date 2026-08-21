export function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    issued: "badge-issued",
    paid: "badge-paid",
    partial: "badge-partial",
    canceled: "badge-canceled",
  };
  const labels: Record<string, string> = {
    issued: "Neincasata",
    paid: "Achitata",
    partial: "Partial",
    canceled: "Anulata",
  };
  return <span className={`badge ${classes[status] ?? ""}`}>{labels[status] ?? status}</span>;
}
