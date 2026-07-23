'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SkeletonPDFManager } from '@/components/admin/Skeleton';
import { isAdmin } from '@/lib/permissions';
import { FaFilePdf, FaUpload, FaDownload, FaTimes, FaCheck, FaCloudUploadAlt, FaFolderOpen } from 'react-icons/fa';

interface SuburbReport {
  id: string;
  suburb: string;
  quarter: string;
  year: number;
  file_url: string;
  file_name: string;
  file_size: number;
  download_count: number;
  view_count: number;
  status: string;
  uploaded_by: string;
  uploaded_at: string;
}

const DEFAULT_SUBURBS = [
  'Oteha',
  'Northcross',
  'Albany',
  'Browns Bay',
  'Glenfield',
  'Pinehill',
  'Rosedale',
  'Long Bay',
  'Torbay',
  'Mairangi Bay',
];

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export default function PDFManagerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reports, setReports] = useState<SuburbReport[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [suburb, setSuburb] = useState('Oteha');
  const [year, setYear] = useState(CURRENT_YEAR.toString());
  const [quarter, setQuarter] = useState('Q2');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const userEmail = session?.user?.email ?? '';
  const isUserAdmin = isAdmin(userEmail);

  useEffect(() => {
    if (status === 'authenticated' && !isUserAdmin) {
      router.push('/admin/dashboard');
    }
  }, [status, isUserAdmin, router]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/pdf/reports');
      const data = await res.json();
      if (res.ok && data.reports) {
        setReports(data.reports);
      }
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated' && isUserAdmin) {
      fetchReports();
    }
  }, [status, isUserAdmin]);

  const showNotify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleOpenUploadModal = (initialFile?: File) => {
    if (initialFile) {
      setFile(initialFile);
    }
    setIsModalOpen(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const droppedFile = droppedFiles[0];
      if (droppedFile.type === 'application/pdf') {
        handleOpenUploadModal(droppedFile);
      } else {
        showNotify('error', 'Only PDF files are supported');
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      showNotify('error', 'Please select a PDF file');
      return;
    }

    if (file.type !== 'application/pdf') {
      showNotify('error', 'Only PDF files are accepted');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('suburb', suburb);
      formData.append('quarter', quarter);
      formData.append('year', year);

      const res = await fetch('/api/admin/pdf/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showNotify('success', `Report for ${suburb} ${year}-${quarter} uploaded successfully`);
        setIsModalOpen(false);
        setFile(null);
        fetchReports();
      } else {
        showNotify('error', data.error || 'Failed to upload report');
      }
    } catch {
      showNotify('error', 'Network error while uploading report');
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  if (status === 'loading') {
    return <SkeletonPDFManager />;
  }

  if (!session || !isUserAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-600">This page is only available to administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {notification && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between text-sm font-medium ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === 'success' ? <FaCheck /> : <FaTimes />}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Suburb PDF Manager</h1>
          <p className="text-gray-600 mt-1">
            Upload quarterly market reports to Cloudflare R2 and manage active suburb PDFs
          </p>
        </div>
        <button
          onClick={() => handleOpenUploadModal()}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center space-x-2 cursor-pointer"
        >
          <FaUpload />
          <span>+ Upload Report</span>
        </button>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => handleOpenUploadModal()}
        className={`bg-white rounded-xl shadow-sm border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
          isDragging ? 'border-blue-500 bg-blue-50/50 scale-[1.01]' : 'border-gray-300 hover:border-blue-400 hover:bg-slate-50/50'
        }`}
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-600 mb-4">
          <FaCloudUploadAlt className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Quarterly Report</h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto text-sm">
          Drag and drop a PDF file here, or click anywhere to select Suburb, Year and Quarter
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenUploadModal();
          }}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors inline-flex items-center space-x-2 shadow-sm"
        >
          <FaFolderOpen />
          <span>Browse Files / Open Selector</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Uploaded Reports</h2>
            <p className="text-sm text-gray-500">
              Active quarterly reports served to leads and public website downloads
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full">
            Total: {reports.length}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading quarterly reports...</div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-600 mb-4">
              <FaFilePdf className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reports Uploaded Yet</h3>
            <p className="text-gray-600 max-w-md mx-auto mb-6 text-sm">
              Click the button below to upload your first quarterly suburb market report.
            </p>
            <button
              onClick={() => handleOpenUploadModal()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors inline-flex items-center space-x-2"
            >
              <FaUpload />
              <span>Upload Quarterly Report</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-slate-50 border-b border-gray-200 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Suburb</th>
                  <th className="px-6 py-3">Quarter / Year</th>
                  <th className="px-6 py-3">File Info</th>
                  <th className="px-6 py-3">Downloads</th>
                  <th className="px-6 py-3">Uploaded By</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {reports.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-900">{item.suburb}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {item.year}-{item.quarter}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 truncate max-w-xs">{item.file_name}</div>
                      <div className="text-xs text-gray-400">{formatFileSize(item.file_size)}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-800">{item.download_count ?? 0}</td>
                    <td className="px-6 py-4 text-xs text-gray-500">{item.uploaded_by || 'Admin'}</td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {item.uploaded_at ? new Date(item.uploaded_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
                      >
                        <FaDownload className="w-3 h-3" />
                        <span>View PDF</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <svg className="h-5 w-5 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Report Storage & Delivery</h3>
            <div className="mt-2 text-sm text-blue-700 space-y-1">
              <p>• PDF files are stored directly in Cloudflare R2 object storage.</p>
              <p>• Quarterly PDF reports selected by Suburb + Quarter (e.g., Oteha 2026-Q2) are delivered to homepage downloads and Marie&apos;s outreach mail campaigns.</p>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FaCloudUploadAlt className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-bold">Upload Quarterly Suburb Report</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Suburb <span className="text-red-500">*</span>
                </label>
                <select
                  value={suburb}
                  onChange={(e) => setSuburb(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900"
                >
                  {DEFAULT_SUBURBS.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Year <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900"
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y.toString()}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Quarter <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={quarter}
                    onChange={(e) => setQuarter(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900"
                  >
                    {QUARTERS.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  PDF Report File <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-blue-500 transition-colors bg-slate-50">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                  />
                  {file && (
                    <div className="mt-2 text-xs font-semibold text-blue-700">
                      Selected: {file.name} ({formatFileSize(file.size)})
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium text-sm transition-colors flex items-center space-x-2 cursor-pointer"
                >
                  {isUploading ? (
                    <span>Uploading...</span>
                  ) : (
                    <>
                      <FaUpload />
                      <span>Upload to R2</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
