'use client';

import { useState } from 'react';
import { useBudgetStore } from '@/lib/stores/budget-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BudgetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId?: string;
  availableAgents: string[];
}

export function BudgetFormModal({
  isOpen,
  onClose,
  agentId: editingAgentId,
  availableAgents,
}: BudgetFormModalProps) {
  const { setBudget, getBudget } = useBudgetStore();
  
  // Get existing budget if editing
  const existingBudget = editingAgentId ? getBudget(editingAgentId) : null;
  
  const [agentId, setAgentId] = useState(editingAgentId || '');
  const [monthlyLimit, setMonthlyLimit] = useState(
    existingBudget?.monthlyLimit.toString() || ''
  );
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const limit = parseFloat(monthlyLimit);
    if (!agentId || isNaN(limit) || limit <= 0) {
      alert('Please enter a valid agent and budget amount');
      return;
    }
    
    setBudget(agentId, limit);
    onClose();
    
    // Reset form
    setAgentId('');
    setMonthlyLimit('');
  };

  return (
    <Dialog key={editingAgentId || 'new'} open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingAgentId ? 'Edit Budget' : 'Add Budget'}
          </DialogTitle>
          <DialogDescription>
            Set a monthly spending limit for an agent
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Agent Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Agent</label>
              {editingAgentId ? (
                <Input
                  value={agentId}
                  disabled
                  className="font-mono"
                />
              ) : (
                <Select value={agentId} onValueChange={(value) => value && setAgentId(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAgents.map((agent) => (
                      <SelectItem key={agent} value={agent} className="font-mono">
                        {agent}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            {/* Monthly Limit */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Monthly Budget Limit
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--tenant-text-muted)' }}>
                  $
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={monthlyLimit}
                  onChange={(e) => setMonthlyLimit(e.target.value)}
                  placeholder="100.00"
                  className="pl-7"
                  required
                />
              </div>
              <p className="text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
                Alert thresholds: 80% (warning), 90% (critical), 100% (exceeded)
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {editingAgentId ? 'Update' : 'Add'} Budget
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
