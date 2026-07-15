import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

export default function StatsCard({ title, value, icon: Icon, color, subtitle }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm transition-colors hover:border-slate-300">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-500 sm:text-sm">{title}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{value}</p>
            {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <div className={`ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color} sm:h-11 sm:w-11`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
