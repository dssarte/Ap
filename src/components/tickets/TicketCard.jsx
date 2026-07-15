import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Building2, AlertCircle, Tag, ChevronRight } from "lucide-react";
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

export default function TicketCard({ ticket, onClick }) {
  return (
    <Card
      className="group cursor-pointer rounded-2xl border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
      onClick={() => onClick(ticket)}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 sm:gap-5">
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
          
          <div className="mt-1 flex shrink-0 items-center gap-2">
            {ticket.priority === 'urgent' && <AlertCircle className="h-5 w-5 text-red-500" />}
            <ChevronRight className="h-5 w-5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-700" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
