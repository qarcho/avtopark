export function Logo() {
  return (
    <div
      aria-hidden
      className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent font-plate text-[15px] font-bold text-accent-ink"
    >
      GE
    </div>
  );
}

/** Georgian number plate, like on the car. */
export function Plate({ plate }: { plate: string }) {
  return (
    <span className="inline-flex items-stretch overflow-hidden rounded border-[1.5px] border-[#131925] bg-white font-plate text-sm leading-none font-bold tracking-wide whitespace-nowrap text-[#111]">
      <span className="flex items-end bg-[#1E40AF] px-[3px] pt-[3px] text-[8px] text-white">GE</span>
      <span className="px-1.5 py-1">{plate}</span>
    </span>
  );
}
