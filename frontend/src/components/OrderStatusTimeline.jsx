const steps = [
  { status: "QUEUED", title: "In the queue", timestamp: "queuedAt" },
  { status: "PREPARING", title: "Preparing", timestamp: "preparingAt" },
  { status: "READY", title: "Ready for pickup", timestamp: "readyAt" },
  { status: "COMPLETED", title: "Picked up", timestamp: "completedAt" },
];

const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const OrderStatusTimeline = ({ status, order }) => {
  if (status === "PENDING_PAYMENT") {
    return (
      <section className="rounded-3xl border border-orange-100 bg-orange-50 p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-700">Payment pending</p>
        <h2 className="mt-2 text-xl font-semibold text-navy">Your order is not in the queue yet</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Once payment is confirmed, the canteen will assign a queue token and begin preparation.</p>
      </section>
    );
  }

  if (status === "CANCELLED") {
    return (
      <section className="rounded-3xl border border-red-100 bg-red-50 p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-700">Order cancelled</p>
        <h2 className="mt-2 text-xl font-semibold text-red-900">This order won&apos;t be prepared</h2>
        <p className="mt-2 text-sm leading-6 text-red-800/80">
          {formatTime(order.cancelledAt) ? `Cancelled ${formatTime(order.cancelledAt)}.` : "The canteen cancelled this order."}
        </p>
      </section>
    );
  }

  const currentIndex = steps.findIndex((step) => step.status === status);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Order progress</p>
          <h2 className="mt-1 text-xl font-semibold text-navy">From queue to pickup</h2>
        </div>
        {status === "COMPLETED" && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Complete</span>}
      </div>

      <ol className="mt-7 space-y-0">
        {steps.map((step, index) => {
          const complete = currentIndex >= 0 && index < currentIndex;
          const current = index === currentIndex;
          const timestamp = formatTime(order[step.timestamp]);
          const color = complete
            ? "border-emerald-500 bg-emerald-500 text-white"
            : current
              ? "border-blue-600 bg-blue-600 text-white ring-4 ring-blue-100"
              : "border-slate-200 bg-white text-slate-400";

          return (
            <li key={step.status} className="relative flex min-h-[4.5rem] gap-4">
              {index < steps.length - 1 && (
                <span aria-hidden="true" className={`absolute left-[15px] top-8 h-[calc(100%-1rem)] w-0.5 ${complete ? "bg-emerald-300" : "bg-slate-200"}`} />
              )}
              <span className={`relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${color}`}>
                {complete ? "✓" : index + 1}
              </span>
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3 pb-5">
                <div>
                  <p className={`text-sm font-semibold ${current || complete ? "text-navy" : "text-slate-400"}`}>
                    {step.title}{current && <span className="ml-2 text-xs font-medium text-blue-700">Current</span>}
                  </p>
                  {timestamp && <p className="mt-1 text-xs text-slate-500">{timestamp}</p>}
                </div>
                {complete && <span className="text-xs font-semibold text-emerald-700">Done</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export default OrderStatusTimeline;
