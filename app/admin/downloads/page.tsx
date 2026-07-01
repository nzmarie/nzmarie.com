'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SkeletonDownloads } from '@/components/admin/Skeleton';

const SUPER_ADMIN = 'nzlouis.com@gmail.com';

export default function DownloadsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email !== SUPER_ADMIN) {
      router.push('/admin/dashboard');
    }
  }, [status, session, router]);

  // Show skeleton while session resolves — Navbar stays visible
  if (status === 'loading') {
    return <SkeletonDownloads />;
  }

  if (!session || session.user?.email !== SUPER_ADMIN) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-600">This page is only available to super administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📥 Downloads</h1>
          <p className="text-gray-600 mt-1">Track PDF downloads and monitor user engagement</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
          Export Data
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Downloads', value: '0', subtitle: 'All time' },
          { label: 'This Month',      value: '0', subtitle: 'Current period' },
          { label: 'Avg per User',    value: '0', subtitle: 'Per email' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
            <div className="text-sm font-medium text-gray-900">{stat.label}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.subtitle}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Downloads</h2>
        </div>
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-400 mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Downloads Yet</h3>
          <p className="text-gray-600 max-w-md mx-auto">
            Download records will appear here once users start downloading market reports.
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <svg className="h-5 w-5 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Under Development</h3>
            <p className="mt-2 text-sm text-blue-700">
              Full download tracking with filtering, pagination, and detailed user behavior analytics
              is being implemented.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
