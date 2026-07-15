import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { safeDate } from "@/lib/dateUtils";

export default function SLAIndicator({ ticket, compact = false }) {
  if (!ticket.sla_response_due && !ticket.sla_resolution_due) {
    return null;
  }

  const now = new Date();
  const responseDue = safeDate(ticket.sla_response_due);
  const resolutionDue = safeDate(ticket.sla_resolution_due);

  // Determine which SLA to show
  const showResponse = !ticket.first_response_at && responseDue;
  const showResolution = !ticket.resolved_at && resolutionDue;

  if (!showResponse && !showResolution) {
    return compact ? null : (
      <Badge className="bg-green-50 text-green-700 border border-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        SLA Met
      </Badge>
    );
  }

  const activeDue = showResponse ? responseDue : resolutionDue;
  const slaType = showResponse ? 'Response' : 'Resolution';
  const breached = showResponse ? ticket.sla_response_breached : ticket.sla_resolution_breached;

  const timeRemaining = activeDue - now;
  const hoursRemaining = timeRemaining / (1000 * 60 * 60);

  let variant = 'default';
  let icon = Clock;
  let color = 'bg-blue-50 text-blue-700 border-blue-200';

  if (breached || timeRemaining < 0) {
    variant = 'destructive';
    icon = XCircle;
    color = 'bg-red-50 text-red-700 border-red-200';
  } else if (hoursRemaining < 2) {
    icon = AlertTriangle;
    color = 'bg-orange-50 text-orange-700 border-orange-200';
  } else if (hoursRemaining < 4) {
    icon = AlertTriangle;
    color = 'bg-yellow-50 text-yellow-700 border-yellow-200';
  }

  const Icon = icon;
  const timeText = breached || timeRemaining < 0
    ? 'Breached'
    : activeDue && !Number.isNaN(activeDue.getTime())
      ? formatDistanceToNow(activeDue, { addSuffix: true })
      : 'SLA unavailable';

  if (compact) {
    return (
      <Badge className={`${color} border`}>
        <Icon className="w-3 h-3 mr-1" />
        {timeText}
      </Badge>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${color}`}>
      <Icon className="w-4 h-4" />
      <div className="flex flex-col">
        <span className="text-xs font-medium">{slaType} SLA</span>
        <span className="text-xs">{timeText}</span>
      </div>
    </div>
  );
}