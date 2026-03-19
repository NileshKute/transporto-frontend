import { PackageOpen } from 'lucide-react';

export function EmptyState({ message = 'No data found', description }: { message?: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#F4F6F8] flex items-center justify-center mb-4 border border-[#E0E8F0]">
        <PackageOpen className="w-8 h-8 text-[#7A9AB8]" />
      </div>
      <p className="font-['Oswald'] font-medium text-[#0D2847]">{message}</p>
      {description && <p className="font-['Rajdhani'] text-[#7A9AB8] text-sm mt-1">{description}</p>}
    </div>
  );
}
