export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-[420px] bg-slate-200" />
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-10 lg:grid-cols-[1fr_380px]">
        <div className="h-72 rounded-2xl bg-slate-200" />
        <div className="h-72 rounded-2xl bg-slate-200" />
      </div>
    </div>
  );
}
