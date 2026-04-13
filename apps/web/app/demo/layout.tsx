/**
 * Demo layout - no auth required, uses mock data
 */

import { Sidebar } from '@/components/layout/sidebar';

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
              Demo Mode
            </div>
            <p className="text-sm text-gray-500">
              Using generated demo data
            </p>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
