import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Layers, Loader2 } from 'lucide-react';
import NoFindingsPie, { pieSlices } from '@/components/audit/NoFindingsPie';

// An item's weight in an audit's NO count: its points (point-based
// checklists such as Mayon's walkthrough), otherwise 1 — as the Audit page
// counts it.
const itemPoints = (item) => { const n = Number(item?.pts); return n > 0 ? n : 1; };

/**
 * A checklist's NO findings by category — its sections, those with the same
 * title counted as one. template: the checklist (with sections); itemCounts:
 * [{ itemId, times }], how often each item was answered NO. Each category
 * holds its items' NO answers times their points; answers to items no longer
 * in the checklist are a category of their own. Largest first.
 */
export function noFindingsByCategory(template, itemCounts) {
  const times = new Map(itemCounts.map(count => [count.itemId, count.times]));
  const known = new Set();
  const categories = new Map();
  (template?.sections || []).forEach((section, index) => {
    const name = String(section.title || '').trim() || `Section ${index + 1}`;
    const key = name.toLowerCase();
    const category = categories.get(key) || { key, name, value: 0, items: [] };
    (section.items || []).forEach(item => {
      known.add(String(item.id));
      const n = times.get(String(item.id)) || 0;
      if (!n) return;
      category.value += n * itemPoints(item);
      category.items.push({ label: String(item.label || '').trim() || 'Unlabelled item', times: n });
    });
    categories.set(key, category);
  });
  const all = [...categories.values()];
  const removed = itemCounts.filter(count => !known.has(count.itemId)).reduce((acc, count) => acc + count.times, 0);
  if (removed) all.push({ key: '__removed', name: 'Items no longer in this checklist', value: removed, items: [] });
  return all.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

// The tooltip's line for a category: its items marked NO most often.
function mostOften(items) {
  if (!items.length) return null;
  const top = [...items].sort((a, b) => b.times - a.times || a.label.localeCompare(b.label));
  const named = top.slice(0, 3).map(item => `${item.label} (${item.times.toLocaleString()})`).join(', ');
  return `Most often: ${named}${top.length > 3 ? ` and ${top.length - 3} more` : ''}`;
}

/**
 * options: checklists with NO findings in range ({ id, title, noFindings }),
 * most first; value / onChange: the one picked. template + itemCounts: the
 * data shown — while another checklist loads (stale) it's the previous one's,
 * dimmed. loading: nothing to show yet.
 */
export default function NoFindingsByCategoryCard({ options, value, onChange, template, itemCounts, loading, stale, error }) {
  // Every category is listed, those without NO findings too.
  const { slices, rows, total } = useMemo(() => {
    if (!template || !itemCounts) return { slices: [], rows: [], total: 0 };
    return pieSlices(
      noFindingsByCategory(template, itemCounts).map(category => ({
        key: category.key,
        name: category.name,
        value: category.value,
        detail: mostOften(category.items),
      })),
      'categories',
    );
  }, [template, itemCounts]);

  let body;
  if (!options.length) {
    body = <p className="py-8 text-center text-sm text-slate-400">No NO findings in this range.</p>;
  } else if (error) {
    body = (
      <p className={`rounded-md px-3 py-2 text-sm ${error.missingRpc ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}>
        {error.missingRpc ? error.message : `Couldn't load the categories: ${error.message}`}
      </p>
    );
  } else if (loading || (stale && !total)) {
    body = <div className="flex h-[260px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  } else if (!total) {
    body = <p className="py-8 text-center text-sm text-slate-400">No NO findings for this checklist in range.</p>;
  } else {
    body = (
      <div className={`transition-opacity ${stale ? 'opacity-50' : ''}`} aria-busy={stale || undefined}>
        <NoFindingsPie slices={slices} rows={rows} noun="categories" />
      </div>
    );
  }

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-2 pt-5 px-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="min-w-0">
          <p className="font-bold text-slate-800 flex items-center gap-2"><Layers className="h-4 w-4 text-red-500" /> NO Findings by Category</p>
          <p className="text-xs text-slate-500">
            {total && template
              ? `Each category's share of the ${total.toLocaleString()} NO findings in ${template.title || 'this checklist'} — categories are the checklist's sections.`
              : 'Each category\'s share of a checklist\'s NO findings in range — categories are the checklist\'s sections.'}
          </p>
        </div>
        {options.length > 0 && (
          <Select value={value || undefined} onValueChange={onChange}>
            <SelectTrigger className="h-9 w-full shrink-0 sm:w-80" aria-label="Checklist">
              <SelectValue placeholder="Choose a checklist" />
            </SelectTrigger>
            <SelectContent>
              {options.map(option => (
                <SelectItem key={option.id} value={option.id}>
                  {option.title} ({option.noFindings.toLocaleString()} NO)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="px-5 pb-5">{body}</CardContent>
    </Card>
  );
}
