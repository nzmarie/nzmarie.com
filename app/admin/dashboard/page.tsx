"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Lead {
  id: string;
  client_name: string;
  property_address: string;
  email: string;
  phone: string;
  timeline: string;
  motivation: string;
  status: string;
  created_at: string;
}

interface Report {
  id: string;
  suburb: string;
  version: string;
  title: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [activeTab, setActiveTab] = useState<"leads" | "reports">("leads");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      Promise.all([
        fetch("/api/admin/leads").then((r) => r.json()),
        fetch("/api/admin/reports").then((r) => r.json()),
      ]).then(([leadsData, reportsData]) => {
        if (leadsData.success) setLeads(leadsData.leads);
        if (reportsData.success) setReports(reportsData.reports);
        setLoading(false);
      });
    }
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-600 text-xl">Loading...</div>
      </div>
    );
  }

  const priorityColor: Record<string, string> = {
    "within-3-months": "bg-red-100 text-red-700",
    "3-6-months": "bg-yellow-100 text-yellow-700",
    "6-12-months": "bg-green-100 text-green-700",
    "just-exploring": "bg-slate-100 text-slate-600",
  };

  const statusColor: Record<string, string> = {
    Pending: "bg-blue-100 text-blue-700",
    Contacted: "bg-yellow-100 text-yellow-700",
    Appraised: "bg-purple-100 text-purple-700",
    Listed: "bg-indigo-100 text-indigo-700",
    Won: "bg-green-100 text-green-700",
    Lost: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Welcome back, {session?.user?.name || session?.user?.email?.split('@')[0]}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">Total Leads</p>
          <p className="text-3xl font-bold text-slate-800">{leads.length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">High Priority</p>
          <p className="text-3xl font-bold text-red-600">
            {leads.filter((l) => l.timeline === "within-3-months").length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">Active Reports</p>
          <p className="text-3xl font-bold text-indigo-600">{reports.filter((r) => r.is_active).length}</p>
        </div>
      </div>

      {/* Tabs Content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="flex border-b border-slate-100">
          <button
            id="tab-leads"
            onClick={() => setActiveTab("leads")}
            className={`px-6 py-4 text-sm font-medium transition-colors ${activeTab === "leads" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            Leads ({leads.length})
          </button>
          <button
            id="tab-reports"
            onClick={() => setActiveTab("reports")}
            className={`px-6 py-4 text-sm font-medium transition-colors ${activeTab === "reports" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            Reports ({reports.length})
          </button>
        </div>

        {activeTab === "leads" && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Address</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Timeline</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{lead.client_name}</div>
                      <div className="text-sm text-slate-500">{lead.phone}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{lead.property_address}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${priorityColor[lead.timeline] || "bg-slate-100 text-slate-600"}`}>
                        {lead.timeline || "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[lead.status] || "bg-slate-100 text-slate-600"}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(lead.created_at).toLocaleDateString("en-NZ")}
                    </td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">No leads yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "reports" && (
          <div className="p-6">
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div>
                    <div className="font-medium text-slate-800">{report.title}</div>
                    <div className="text-sm text-slate-500">{report.suburb} · v{report.version}</div>
                  </div>
                  {report.is_active && (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">Active</span>
                  )}
                </div>
              ))}
              {reports.length === 0 && (
                <p className="text-center text-slate-400 py-8">No reports uploaded yet</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
