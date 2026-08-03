import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Building2, AlertCircle, Tag, ChevronRight} from "lucide-react";
import { formatPHDateTime } from "@/lib/dateUtils";
import SLAIndicator from "./SLAIndicator";

const statusColors = {
  pending_approval: "bg-yellow-50 text-yellow-700 border-yellow-200",
  open: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  pending: "bg-purple-50 text-purple-700 border-purple-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-slate-50 text-slate-600 border-slate-200"
};

const priorityColors = {
  low: "bg-slate-50 text-slate-600 border border-slate-200",
  medium: "bg-blue-50 text-blue-600 border border-blue-200",
  high: "bg-orange-50 text-orange-600 border border-orange-200",
  urgent: "bg-red-50 text-red-600 border border-red-200"
};

export default function TicketCard({ ticket, onClick, unreadCount = 0 }) {
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);

  return (
    <Card
      className={`group cursor-pointer rounded-2xl bg-white shadow-sm transition-all hover:border-emerald-300 hover:shadow-md ${duplicatesOpen ? '' : 'hover:-translate-y-0.5'} ${unreadCount > 0 ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200'}`}
      onClick={() => onClick(ticket)}
    >
     <CardContent className="p-4 sm:p-5">
        <div className="flex items-stretch justify-between gap-3 sm:gap-5">
          <div className="flex-1 min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className={`${priorityColors[ticket.priority] || priorityColors.medium} text-xs font-semibold uppercase tracking-wide`}>
                {ticket.priority}
              </Badge>
              <Badge className={`${statusColors[ticket.status] || statusColors.open} border text-xs font-semibold uppercase tracking-wide`}>
                {ticket.status?.replace('_', ' ')}
              </Badge>
              {ticket.escalated && (
                <Badge className="bg-red-100 text-red-700 border border-red-300 text-xs font-semibold uppercase tracking-wide">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Escalated
                </Badge>
              )}
              {ticket.category_name && (
                <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold">
                  <Tag className="w-3 h-3 mr-1" />
                  {ticket.category_name}
                </Badge>
              )}
              <SLAIndicator ticket={ticket} compact />
            </div>
            
            <h3 className="mb-1.5 truncate text-base font-semibold text-slate-900 sm:text-lg">
              {ticket.title}
            </h3>
            
            <p className="mb-4 line-clamp-2 text-sm leading-6 text-slate-500">
              {ticket.description}
            </p>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {ticket.department_name}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {ticket.submitter_name || ticket.submitter_email}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatPHDateTime(ticket.created_date)}
              </span>
            </div>
          </div>
          
          <div className="mt-1 flex shrink-0 flex-col items-end justify-between gap-2">
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
  <span
    className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500 shadow-sm"
    aria-label={`${unreadCount} unread update${unreadCount === 1 ? '' : 's'}`}
    title={`${unreadCount} unread update${unreadCount === 1 ? '' : 's'}`}
  />
)}
              {ticket.priority === 'urgent' && <AlertCircle className="h-5 w-5 text-red-500" />}
              <ChevronRight className="h-5 w-5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-700" />
            </div>
            {ticket._duplicates && (
              <DuplicatesBadge duplicates={ticket._duplicates} open={duplicatesOpen} setOpen={setDuplicatesOpen} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DuplicatesBadge({ duplicates, open, setOpen }) {
  const entries = Object.entries(duplicates);
  const total = entries.reduce((sum, [, dates]) => sum + dates.length, 0);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
      >
        Duplicates ({total})
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white shadow-lg">
          {entries.map(([templateTitle, dates]) => (
            <div key={templateTitle}>
              <div className="px-3 pt-2 text-[11px] font-semibold text-slate-500">{templateTitle}</div>
              <div className={`px-3 pb-2 pt-1 text-[11px] text-slate-500 ${dates.length > 5 ? 'max-h-32 overflow-y-auto' : ''}`}>
                {dates.map((d, i) => (
                  <div key={i} className="py-0.5">{formatPHDateTime(d)}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}