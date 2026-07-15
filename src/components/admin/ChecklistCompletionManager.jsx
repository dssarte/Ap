import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CalendarCheck } from "lucide-react";

export default function ChecklistCompletionManager() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: allTemplates = [], isLoading: tLoading } = useQuery({
    queryKey: ['audit-templates-active-admin'],
    queryFn: () => base44.entities.AuditTemplate.filter({ is_active: true }, '-created_date', 100),
  });

  const { data: configRecords = [], isLoading: cLoading } = useQuery({
    queryKey: ['checklist-completion-config'],
    queryFn: () => base44.entities.ChecklistConfig.filter({ config_key: 'default' }, '-updated_date', 10),
  });

  // Exclude QA audit templates (unrestricted) — only store-restricted checklists count
  const completionTemplates = useMemo(
    () => allTemplates.filter(t => t.store_restrictions?.length > 0 || t.store_name),
    [allTemplates]
  );

  const configRecord = configRecords[0];
  const selectedIds = useMemo(() => {
    if (configRecord?.selected_template_ids) return configRecord.selected_template_ids;
    return completionTemplates.map(t => t.id);
  }, [configRecord, completionTemplates]);

  const persist = async (ids) => {
    setSaving(true);
    try {
      if (configRecord?.id) {
        await base44.entities.ChecklistConfig.update(configRecord.id, { selected_template_ids: ids });
      } else {
        await base44.entities.ChecklistConfig.create({ config_key: 'default', selected_template_ids: ids });
      }
      await queryClient.invalidateQueries({ queryKey: ['checklist-completion-config'] });
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id) => {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    persist(next);
  };

  if (tLoading || cLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="flex items-center gap-2 text-slate-800">
          <CalendarCheck className="w-5 h-5 text-[#1fd655]" /> Checklist Completion Rate Configuration
        </CardTitle>
        <p className="text-sm text-slate-500 mt-1">
          Select which daily checklists count toward the completion rate. This selection applies to all store users and persists globally. QA audit templates are excluded automatically.
        </p>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            {selectedIds.length} of {completionTemplates.length} selected
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => persist(completionTemplates.map(t => t.id))}
              disabled={saving}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => persist([])}
              disabled={saving}
            >
              Clear All
            </Button>
            {saving && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          </div>
        </div>

        {completionTemplates.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">No store-restricted checklists found. QA audit templates are not listed here.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {completionTemplates.map(t => (
              <label
                key={t.id}
                className="flex items-center gap-2.5 p-3 rounded-md bg-white border border-slate-200 hover:border-[#1fd655] cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selectedIds.includes(t.id)}
                  onCheckedChange={() => toggle(t.id)}
                  disabled={saving}
                />
                <span className="text-sm text-slate-700 font-medium truncate">{t.title}</span>
              </label>
            ))}
          </div>
        )}

        <p className="text-xs text-slate-400 pt-2">
          {selectedIds.length === completionTemplates.length
            ? "All eligible checklists are included."
            : "Your selection is saved automatically and applies to all store users."}
        </p>
      </CardContent>
    </Card>
  );
}