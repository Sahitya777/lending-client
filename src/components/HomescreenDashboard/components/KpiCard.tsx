
export function KpiCard({ icon, title, value, highlight }: any) {
  return (
    <div
      className={`rounded-2xl  ${
        highlight ? "ring-2 ring-amber-500/20 bg-[#1E1F1F]" : " bg-[#1E1F1E]"
      } shadow-sm p-3 flex items-center gap-4`}
    >
      <div
        className={`grid h-16 w-16 place-items-center rounded-2xl ${
          highlight ? "bg-amber-500/10" : "bg-[#181818]"
        } `}
      >
        <div className={highlight ? "text-white" : "text-emerald-400"}>
          {icon}
        </div>
      </div>
      <div className="flex-1">
        <div className="text-sm text-gray-400">{title}</div>
        <div
          className={`text-xl font-semibold ${
            highlight ? "text-white" : "text-white"
          }`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}