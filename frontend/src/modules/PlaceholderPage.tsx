import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  name: string;
  path: string;
}

export default function PlaceholderPage({ name, path }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <div className="w-16 h-16 rounded-xl bg-primary-50 flex items-center justify-center mb-4">
        <Construction size={28} className="text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-slate-800 mb-2">{name}</h2>
      <p className="text-slate-500 text-center max-w-md">
        Dieses Modul wird in einer kommenden Phase implementiert.
      </p>
      <div className="mt-4 badge-primary">{path}</div>
    </div>
  );
}
