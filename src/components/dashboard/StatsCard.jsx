import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

export default function StatsCard({ title, value, icon: Icon, color, subtitle }) {
  return (
    <Card className="border-2 border-slate-200 shadow-lg bg-white hover:shadow-xl transition-all duration-300 overflow-hidden group">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{title}</p>
            <p className="text-4xl font-bold text-slate-900">{value}</p>
            {subtitle && <p className="text-xs text-slate-500 mt-2">{subtitle}</p>}
          </div>
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-8 h-8 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}