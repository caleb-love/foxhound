import { create } from "zustand";

const STORAGE_KEY = "foxhound-experiment-compare";

type PersistedPair = {
  baselineExperimentId: string | null;
  candidateExperimentId: string | null;
};

interface ExperimentCompareState extends PersistedPair {
  setPair: (baselineExperimentId: string, candidateExperimentId: string) => void;
  clearPair: () => void;
  swapPair: () => void;
}

function loadPersistedPair(): PersistedPair {
  if (typeof window === "undefined") {
    return {
      baselineExperimentId: null,
      candidateExperimentId: null,
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        baselineExperimentId: null,
        candidateExperimentId: null,
      };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedPair>;
    return {
      baselineExperimentId:
        typeof parsed.baselineExperimentId === "string" ? parsed.baselineExperimentId : null,
      candidateExperimentId:
        typeof parsed.candidateExperimentId === "string" ? parsed.candidateExperimentId : null,
    };
  } catch {
    return {
      baselineExperimentId: null,
      candidateExperimentId: null,
    };
  }
}

function persistPair(pair: PersistedPair) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pair));
}

const initialPair = loadPersistedPair();

export const useExperimentCompareStore = create<ExperimentCompareState>((set, get) => ({
  baselineExperimentId: initialPair.baselineExperimentId,
  candidateExperimentId: initialPair.candidateExperimentId,
  setPair: (baselineExperimentId, candidateExperimentId) => {
    const nextPair = { baselineExperimentId, candidateExperimentId };
    persistPair(nextPair);
    set(nextPair);
  },
  clearPair: () => {
    const nextPair = { baselineExperimentId: null, candidateExperimentId: null };
    persistPair(nextPair);
    set(nextPair);
  },
  swapPair: () => {
    const nextPair = {
      baselineExperimentId: get().candidateExperimentId,
      candidateExperimentId: get().baselineExperimentId,
    };
    persistPair(nextPair);
    set(nextPair);
  },
}));
