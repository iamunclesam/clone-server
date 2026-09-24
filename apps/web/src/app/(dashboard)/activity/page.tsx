"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ActivityLog } from "@/lib/api";

export default function ActivityPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!companyId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await api.getActivity(companyId, 50);
        setActivities(res.activities || []);
      } catch (err) {
        console.warn("Activity API error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="bg-white border border-slate-200 p-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Activity & Audit Timeline</h1>
        <p className="text-xs font-mono text-slate-500 mt-0.5">
          Real-time stream of all actions executed by AI Employees in {activeCompany?.name || "Your Workspace"}
        </p>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 p-12 text-center text-xs font-mono text-slate-400">
          Loading audit activity stream...
        </div>
      ) : activities.length === 0 ? (
        <div className="bg-white border border-slate-200 p-12 text-center text-xs font-mono text-slate-400">
          No activity recorded yet in this workspace.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 divide-y divide-slate-100">
          {activities.map((item) => (
            <div key={item.id} className="p-4 space-y-1 hover:bg-slate-50 transition-colors font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{item.actorName}</span>
                <span className="text-[10px] text-slate-400">
                  {item.createdAt ? new Date(item.createdAt).toLocaleTimeString() : "Just now"}
                </span>
              </div>
              <div className="text-slate-700">
                Action: <span className="text-blue-600 font-bold">{item.action}</span> {item.resource ? `• ${item.resource}` : ""}
              </div>
              {item.details && (
                <p className="text-[11px] text-slate-500 font-sans">{item.details}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
