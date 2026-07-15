import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, Search, Globe, Building2 } from "lucide-react";

export default function CannedResponsePicker({ departmentId, onSelect }) {
  const [open, setOpen] = useState(false);
  const [responses, setResponses] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open && responses.length === 0) {
      loadResponses();
    }
  }, [open]);

  const loadResponses = async () => {
    const all = await base44.entities.CannedResponse.filter({ is_active: true });
    // Show global + department-specific responses
    const filtered = all.filter(r => !r.department_id || r.department_id === departmentId);
    setResponses(filtered);
  };

  const filtered = responses.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.content.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (r) => {
    onSelect(r.content);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Insert canned response"
          className="text-slate-500 hover:text-[#1fd655] hover:bg-[#1fd655]/10"
        >
          <Zap className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" side="top">
        <div className="p-3 border-b">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Canned Responses</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
              autoFocus
            />
          </div>
        </div>
        <ScrollArea className="max-h-72">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">No templates found</p>
          ) : (
            <div className="p-1">
              {filtered.map(r => (
                <button
                  key={r.id}
                  onClick={() => handleSelect(r)}
                  className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[#1fd655]/10 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-slate-800 group-hover:text-slate-900">{r.title}</span>
                    {r.department_id ? (
                      <Badge className="bg-blue-100 text-blue-600 border-0 text-[10px] gap-0.5 py-0 px-1.5">
                        <Building2 className="w-2.5 h-2.5" /> {r.department_name}
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-500 border-0 text-[10px] gap-0.5 py-0 px-1.5">
                        <Globe className="w-2.5 h-2.5" /> Global
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{r.content}</p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}