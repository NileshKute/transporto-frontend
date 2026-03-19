import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, limit, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[#E0E8F0] bg-[#F4F6F8] font-['Rajdhani']">
      <p className="text-sm text-[#1A4A7A]">Showing {start}–{end} of {total}</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-2 text-[#7A9AB8] hover:text-[#0D2847] hover:bg-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-[#E0E8F0]"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
          if (p < 1 || p > totalPages) return null;
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[36px] h-9 text-sm rounded-lg transition-colors font-['Rajdhani'] ${
                p === page
                  ? 'bg-[#1565C0] text-white font-semibold'
                  : 'text-[#1A4A7A] hover:bg-[#F4F6F8] border border-[#E0E8F0]'
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-2 text-[#7A9AB8] hover:text-[#0D2847] hover:bg-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-[#E0E8F0]"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
