import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Zap, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from "lucide-react";

// ─── Config ────────────────────────────────────────────────────────────────
const CONDITION_FIELDS = [
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
  { value: 'department_name', label: 'Department' },
  { value: 'category_name', label: 'Category' },
  { value: 'submitter_email', label: 'Submitter Email' },
  { value: 'title', label: 'Ticket Title' },
  { value: 'description', label: 'Description' },
  { value: 'assigned_to', label: 'Assigned To' },
];

const OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
];

const ACTION_TYPES = [
  { value: 'set_priority', label: 'Set Priority', hasValue: true },
  { value: 'set_status', label: 'Set Status', hasValue: true },
  { value: 'assign_department', label: 'Assign to Department', hasValue: true },
  { value: 'assign_to', label: 'Assign to Staff (email)', hasValue: true },
  { value: 'escalate', label: 'Escalate Ticket', hasValue: false },
];

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];
const STATUS_OPTIONS = ['open', 'in_progress', 'pending', 'resolved', 'closed'];

// ─── Sub-components ─────────────────────────────────────────────────────────
function ConditionRow({ cond, index, onChange, onRemove }) {
  const noValue = cond.operator === 'is_empty' || cond.operator === 'is_not_empty';
  return (
    <div className="flex flex-wrap gap-2 items-center bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
      <span className="text-xs font-semibold text-slate-400 w-8">{index === 0 ? 'IF' : 'AND'}</span>
      <Select value={cond.field} onValueChange={v => onChange({ ...cond, field: v })}>
        <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Field" /></SelectTrigger>
        <SelectContent>{CONDITION_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={cond.operator} onValueChange={v => onChange({ ...cond, operator: v, value: '' })}>
        <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Operator" /></SelectTrigger>
        <SelectContent>{OPERATORS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
      {!noValue && (
        <Input
          className="h-8 text-xs w-36"
          placeholder="Value"
          value={cond.value || ''}
          onChange={e => onChange({ ...cond, value: e.target.value })}
        />
      )}
      <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={onRemove}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function ActionRow({ action, index, departments, onChange, onRemove }) {
  const actionDef = ACTION_TYPES.find(a => a.value === action.type);

  return (
    <div className="flex flex-wrap gap-2 items-center bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-200">
      <span className="text-xs font-semibold text-emerald-600 w-8">THEN</span>
      <Select value={action.type} onValueChange={v => onChange({ type: v, value: '', label: '' })}>
        <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Action" /></SelectTrigger>
        <SelectContent>{ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
      </Select>

      {actionDef?.hasValue && action.type === 'set_priority' && (
        <Select value={action.value} onValueChange={v => onChange({ ...action, value: v })}>
          <SelectTrigger className="w-32 h-8 text-xs capitalize"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>{PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
        </Select>
      )}
      {actionDef?.hasValue && action.type === 'set_status' && (
        <Select value={action.value} onValueChange={v => onChange({ ...action, value: v })}>
          <SelectTrigger className="w-36 h-8 text-xs capitalize"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}</SelectContent>
        </Select>
      )}
      {actionDef?.hasValue && action.type === 'assign_department' && (
        <Select value={action.value} onValueChange={v => {
          const dept = departments.find(d => d.id === v);
          onChange({ ...action, value: v, label: dept?.name || v });
        }}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
      )}
      {actionDef?.hasValue && action.type === 'assign_to' && (
        <Input className="h-8 text-xs w-44" placeholder="staff@email.com" value={action.value || ''} onChange={e => onChange({ ...action, value: e.target.value })} />
      )}

      <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={onRemove}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ─── Rule Form Modal ─────────────────────────────────────────────────────────
function RuleFormModal({ rule, departments, onSave, onClose }) {
  const [form, setForm] = useState(rule || {
    name: '', description: '', is_active: true, order: 0,
    conditions: [{ field: 'priority', operator: 'equals', value: '' }],
    actions: [{ type: 'escalate', value: '', label: '' }],
  });

  const updateCondition = (i, val) => {
    const c = [...form.conditions]; c[i] = val; setForm({ ...form, conditions: c });
  };
  const removeCondition = (i) => setForm({ ...form, conditions: form.conditions.filter((_, idx) => idx !== i) });
  const addCondition = () => setForm({ ...form, conditions: [...form.conditions, { field: 'priority', operator: 'equals', value: '' }] });

  const updateAction = (i, val) => {
    const a = [...form.actions]; a[i] = val; setForm({ ...form, actions: a });
  };
  const removeAction = (i) => setForm({ ...form, actions: form.actions.filter((_, idx) => idx !== i) });
  const addAction = () => setForm({ ...form, actions: [...form.actions, { type: 'escalate', value: '', label: '' }] });

  const isValid = form.name.trim() && form.conditions.length > 0 && form.actions.length > 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{rule?.id ? 'Edit Rule' : 'New Automation Rule'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name & Description */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Rule Name *</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Escalate Urgent Tickets" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Order (lower runs first)</label>
              <Input type="number" value={form.order} onChange={e => setForm({ ...form, order: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Description (optional)</label>
              <Input value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What does this rule do?" />
            </div>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-800">Conditions <span className="text-slate-400 font-normal">(ALL must match)</span></h3>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addCondition}>
                <Plus className="w-3 h-3" /> Add Condition
              </Button>
            </div>
            <div className="space-y-2">
              {form.conditions.map((c, i) => (
                <ConditionRow key={i} cond={c} index={i} onChange={v => updateCondition(i, v)} onRemove={() => removeCondition(i)} />
              ))}
              {form.conditions.length === 0 && <p className="text-xs text-slate-400 italic">No conditions — rule will apply to ALL tickets.</p>}
            </div>
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-800">Actions</h3>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addAction}>
                <Plus className="w-3 h-3" /> Add Action
              </Button>
            </div>
            <div className="space-y-2">
              {form.actions.map((a, i) => (
                <ActionRow key={i} action={a} index={i} departments={departments} onChange={v => updateAction(i, v)} onRemove={() => removeAction(i)} />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-[#1fd655] text-slate-900 hover:bg-[#1bd64d] font-bold" disabled={!isValid} onClick={() => onSave(form)}>
            {rule?.id ? 'Save Changes' : 'Create Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Rule Card ───────────────────────────────────────────────────────────────
function RuleCard({ rule, departments, onEdit, onDelete, onToggle }) {
  const [expanded, setExpanded] = useState(false);

  const conditionSummary = (rule.conditions || []).map(c => {
    const field = CONDITION_FIELDS.find(f => f.value === c.field)?.label || c.field;
    const op = OPERATORS.find(o => o.value === c.operator)?.label || c.operator;
    const noVal = c.operator === 'is_empty' || c.operator === 'is_not_empty';
    return `${field} ${op}${noVal ? '' : ` "${c.value}"`}`;
  }).join(' AND ');

  const actionSummary = (rule.actions || []).map(a => {
    const act = ACTION_TYPES.find(x => x.value === a.type)?.label || a.type;
    return a.value ? `${act}: ${a.label || a.value}` : act;
  }).join(', ');

  return (
    <Card className={`border-2 transition-all ${rule.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'} shadow-sm hover:shadow-md`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${rule.is_active ? 'bg-[#1fd655]/15' : 'bg-slate-100'}`}>
            <Zap className={`w-5 h-5 ${rule.is_active ? 'text-[#1fd655]' : 'text-slate-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900">{rule.name}</span>
              <Badge variant="outline" className="text-xs text-slate-500">Order {rule.order ?? 0}</Badge>
              {rule.is_active
                ? <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">Active</Badge>
                : <Badge variant="secondary" className="text-xs">Inactive</Badge>}
            </div>
            {rule.description && <p className="text-xs text-slate-500 mt-0.5">{rule.description}</p>}

            {!expanded && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="bg-slate-100 rounded px-2 py-1 text-slate-600 truncate max-w-xs">IF {conditionSummary || 'any ticket'}</span>
                <span className="bg-emerald-50 rounded px-2 py-1 text-emerald-700 truncate max-w-xs">→ {actionSummary}</span>
              </div>
            )}

            {expanded && (
              <div className="mt-3 space-y-2">
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">CONDITIONS</p>
                  {(rule.conditions || []).map((c, i) => {
                    const f = CONDITION_FIELDS.find(x => x.value === c.field)?.label || c.field;
                    const o = OPERATORS.find(x => x.value === c.operator)?.label || c.operator;
                    const noVal = c.operator === 'is_empty' || c.operator === 'is_not_empty';
                    return (
                      <div key={i} className="flex items-center gap-1 text-xs bg-slate-50 rounded px-2 py-1 mb-1">
                        <span className="font-semibold text-slate-400">{i === 0 ? 'IF' : 'AND'}</span>
                        <span className="text-slate-700">{f}</span>
                        <span className="text-slate-400">{o}</span>
                        {!noVal && <span className="font-semibold text-slate-800">"{c.value}"</span>}
                      </div>
                    );
                  })}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">ACTIONS</p>
                  {(rule.actions || []).map((a, i) => {
                    const act = ACTION_TYPES.find(x => x.value === a.type)?.label || a.type;
                    return (
                      <div key={i} className="flex items-center gap-1 text-xs bg-emerald-50 rounded px-2 py-1 mb-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-800">{act}{a.label || a.value ? `: ${a.label || a.value}` : ''}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Switch checked={rule.is_active} onCheckedChange={v => onToggle(rule, v)} />
            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-slate-700" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-slate-700" onClick={() => onEdit(rule)}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => onDelete(rule)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function RulesEngine() {
  const [rules, setRules] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [editingRule, setEditingRule] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [r, d] = await Promise.all([
      base44.entities.TicketRule.list('order', 200),
      base44.entities.Department.list(),
    ]);
    setRules(r);
    setDepartments(d);
    setLoading(false);
  };

  const handleSave = async (form) => {
    if (form.id) {
      await base44.entities.TicketRule.update(form.id, form);
    } else {
      await base44.entities.TicketRule.create(form);
    }
    setShowForm(false);
    setEditingRule(null);
    loadData();
  };

  const handleDelete = async () => {
    await base44.entities.TicketRule.delete(deleteTarget.id);
    setDeleteTarget(null);
    loadData();
  };

  const handleToggle = async (rule, value) => {
    await base44.entities.TicketRule.update(rule.id, { is_active: value });
    loadData();
  };

  const handleEdit = (rule) => { setEditingRule(rule); setShowForm(true); };
  const handleNew = () => { setEditingRule(null); setShowForm(true); };

  const activeCount = rules.filter(r => r.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#1fd655]" />
            Automation Rules
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Rules run automatically when a ticket is created. {activeCount} active rule{activeCount !== 1 ? 's' : ''}.
          </p>
        </div>
        <Button className="bg-[#1fd655] text-slate-900 hover:bg-[#1bd64d] font-bold gap-2" onClick={handleNew}>
          <Plus className="w-4 h-4" /> New Rule
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
        <p>Rules are evaluated in order when a ticket is created. All conditions in a rule must match for its actions to run. Multiple rules can apply to the same ticket.</p>
      </div>

      {/* Rules list */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" /></div>
      ) : rules.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-200">
          <CardContent className="p-12 text-center">
            <Zap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-700 mb-1">No rules yet</h3>
            <p className="text-slate-500 text-sm mb-4">Create your first automation rule to auto-assign, escalate, or prioritize tickets.</p>
            <Button className="bg-[#1fd655] text-slate-900 font-bold gap-2" onClick={handleNew}>
              <Plus className="w-4 h-4" /> Create First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <RuleCard
              key={rule.id}
              rule={rule}
              departments={departments}
              onEdit={handleEdit}
              onDelete={r => setDeleteTarget(r)}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <RuleFormModal
          rule={editingRule}
          departments={departments}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingRule(null); }}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete <b>{deleteTarget?.name}</b>? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 text-white hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}