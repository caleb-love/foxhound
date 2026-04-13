/**
 * Global state for cost budgets
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Budget {
  agentId: string;
  monthlyLimit: number;
  alertThresholds: {
    warning: number; // 80%
    critical: number; // 90%
    exceeded: number; // 100%
  };
  enabled: boolean;
}

interface BudgetState {
  budgets: Budget[];

  // Actions
  setBudget: (agentId: string, limit: number) => void;
  removeBudget: (agentId: string) => void;
  toggleBudget: (agentId: string) => void;
  getBudget: (agentId: string) => Budget | undefined;
  getAllBudgets: () => Budget[];
}

export const useBudgetStore = create<BudgetState>()(
  persist(
    (set, get) => ({
      budgets: [],

      setBudget: (agentId, limit) =>
        set((state) => {
          const existing = state.budgets.find((b) => b.agentId === agentId);

          if (existing) {
            // Update existing
            return {
              budgets: state.budgets.map((b) =>
                b.agentId === agentId ? { ...b, monthlyLimit: limit } : b,
              ),
            };
          } else {
            // Add new
            return {
              budgets: [
                ...state.budgets,
                {
                  agentId,
                  monthlyLimit: limit,
                  alertThresholds: {
                    warning: 80,
                    critical: 90,
                    exceeded: 100,
                  },
                  enabled: true,
                },
              ],
            };
          }
        }),

      removeBudget: (agentId) =>
        set((state) => ({
          budgets: state.budgets.filter((b) => b.agentId !== agentId),
        })),

      toggleBudget: (agentId) =>
        set((state) => ({
          budgets: state.budgets.map((b) =>
            b.agentId === agentId ? { ...b, enabled: !b.enabled } : b,
          ),
        })),

      getBudget: (agentId) => {
        return get().budgets.find((b) => b.agentId === agentId);
      },

      getAllBudgets: () => {
        return get().budgets;
      },
    }),
    {
      name: "foxhound-budgets", // localStorage key
    },
  ),
);
