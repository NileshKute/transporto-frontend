export default function TrackLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <header className="bg-[#0D2847] px-4 py-3 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#1A4A7A] animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 bg-[#1A4A7A] rounded animate-pulse" />
            <div className="h-3 w-56 bg-[#1A4A7A]/70 rounded animate-pulse" />
          </div>
        </div>
      </header>
      <main className="flex-1 p-4 max-w-3xl mx-auto w-full space-y-4">
        <div className="h-[50vh] min-h-[280px] rounded-xl bg-[#E2E8F0] animate-pulse border border-[#E0E8F0]" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-white border border-gray-100 shadow-sm animate-pulse" />
          ))}
        </div>
        <div className="h-32 rounded-xl bg-white border border-gray-100 animate-pulse" />
      </main>
      <footer className="bg-[#F1F5F9] py-3 text-center text-sm text-[#64748b]">
        <div className="h-4 w-64 bg-[#E2E8F0] rounded mx-auto animate-pulse" />
      </footer>
    </div>
  );
}
