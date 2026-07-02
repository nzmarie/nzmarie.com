"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { SkeletonDashboard } from "@/components/admin/Skeleton";
import { SuburbFilter } from "@/components/admin/SuburbFilter";

interface DashboardStats {
  newLeads: number;
  highPriorityLeads: number;
  pendingOutreach: number;
  todayFollowups: number;
  overdueFollowups: number;
  todayDownloads: number;
}

interface FollowUp {
  id: string;
  name: string;
  email: string;
  phone: string;
  property_address: string;
  suburb: string;
  priority: string;
  contact_status: string;
  follow_up_at: string;
  last_contact_at: string;
  agent_notes: string;
}

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-700";
    case "medium":
      return "bg-yellow-100 text-yellow-700";
    case "low":
      return "bg-green-100 text-green-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

const getPriorityDot = (priority: string): string => {
  switch (priority) {
    case "high":
      return "🔴";
    case "medium":
      return "🟡";
    case "low":
      return "🟢";
    default:
      return "⚪";
  }
};

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suburbFilter, setSuburbFilter] = useState<string>('all');

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
    }
  }, [status, router]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const statsParams = new URLSearchParams();
      if (suburbFilter && suburbFilter !== 'all') {
        statsParams.set('suburb', suburbFilter);
      }

      const bookingsParams = new URLSearchParams({ page: '1', limit: '10' });
      if (suburbFilter && suburbFilter !== 'all') {
        bookingsParams.set('suburb', suburbFilter);
      }

      const statsUrl = `/api/admin/dashboard/stats${statsParams.toString() ? `?${statsParams}` : ''}`;
      const [statsRes, followupsRes] = await Promise.all([
        fetch(statsUrl),
        fetch(`/api/admin/bookings?${bookingsParams}`),
      ]);

      if (!statsRes.ok || !followupsRes.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      const statsData = await statsRes.json();
      const followupsData = await followupsRes.json();

      if (statsData.success) {
        setStats(statsData.stats);
      }

      if (followupsData.data) {
        const todayFollowups = followupsData.data.filter((lead: FollowUp) => {
          if (!lead.follow_up_at) return false;
          const followUpDate = new Date(lead.follow_up_at).toDateString();
          const today = new Date().toDateString();
          return (
            followUpDate === today &&
            !["converted", "lost"].includes(lead.contact_status)
          );
        });
        setFollowUps(todayFollowups);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard"
      );
      setLoading(false);
    }
  }, [suburbFilter]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchDashboardData();
    }
  }, [status, fetchDashboardData]);

  if (status === "loading" || loading) {
    return <SkeletonDashboard />;
  }

  const userName =
    session?.user?.name || session?.user?.email?.split("@")[0] || "User";

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {userName}</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-4">
        <SuburbFilter
          value={suburbFilter}
          onChange={setSuburbFilter}
          label="Filter by Suburb"
          showLabel={true}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 font-medium">
            Total Leads
          </p>
          <p className="text-2xl font-bold text-slate-800 mt-2">
            {stats?.newLeads ?? 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">This month</p>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 font-medium">
            Downloads
          </p>
          <p className="text-2xl font-bold text-indigo-600 mt-2">
            {stats?.todayDownloads ?? 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">Today</p>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 font-medium">
            High Priority
          </p>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {stats?.highPriorityLeads ?? 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">Urgent</p>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 font-medium">
            Outreach
          </p>
          <p className="text-2xl font-bold text-amber-600 mt-2">
            {stats?.pendingOutreach ?? 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">Pending</p>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 font-medium">
            Follow-ups
          </p>
          <p className="text-2xl font-bold text-blue-600 mt-2">
            {stats?.todayFollowups ?? 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">Today</p>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 font-medium">
            Overdue
          </p>
          <p className="text-2xl font-bold text-orange-600 mt-2">
            {stats?.overdueFollowups ?? 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">Follow-ups</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-slate-100">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">
              Today&apos;s Follow-ups
            </h2>
            {followUps.length > 0 && (
              <p className="text-sm text-slate-500 mt-1">
                {followUps.length} leads need attention
              </p>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {followUps.length > 0 ? (
              followUps.map((followUp) => (
                <div key={followUp.id} className="p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {getPriorityDot(followUp.priority)}
                        </span>
                        <h3 className="font-medium text-slate-900">
                          {followUp.name}
                        </h3>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(followUp.priority)}`}
                        >
                          {followUp.priority.charAt(0).toUpperCase() +
                            followUp.priority.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        {followUp.property_address}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {followUp.suburb}
                        {followUp.last_contact_at &&
                          ` • Last contact: ${new Date(followUp.last_contact_at).toLocaleDateString("en-NZ")}`}
                      </p>
                      {followUp.agent_notes && (
                        <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-2 rounded">
                          {followUp.agent_notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <a
                        href={`tel:${followUp.phone}`}
                        className="inline-flex items-center justify-center w-9 h-9 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        title="Call"
                      >
                        📞
                      </a>
                      <a
                        href={`mailto:${followUp.email}`}
                        className="inline-flex items-center justify-center w-9 h-9 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors ml-2"
                        title="Email"
                      >
                        ✉️
                      </a>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <p className="text-slate-500">No follow-ups scheduled for today</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-100">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">
              Quick Stats
            </h2>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-sm text-slate-700">Total Bookings</span>
              <span className="text-xl font-bold text-blue-600">
                {stats && stats.newLeads + stats.highPriorityLeads}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <span className="text-sm text-slate-700">Urgent</span>
              <span className="text-xl font-bold text-red-600">
                {stats?.highPriorityLeads ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
              <span className="text-sm text-slate-700">Pending Outreach</span>
              <span className="text-xl font-bold text-amber-600">
                {stats?.pendingOutreach ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <span className="text-sm text-slate-700">Overdue</span>
              <span className="text-xl font-bold text-orange-600">
                {stats?.overdueFollowups ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
              <span className="text-sm text-slate-700">Today Downloads</span>
              <span className="text-xl font-bold text-indigo-600">
                {stats?.todayDownloads ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
