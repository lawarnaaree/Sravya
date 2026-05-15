import { create } from "zustand";
import type { DownloadJob } from "@/api";

interface DownloadQueueState {
  jobs: DownloadJob[];
  pendingUrl: string | null;
  toastMessage: string | null;
  setJobs: (jobs: DownloadJob[]) => void;
  upsertJob: (job: DownloadJob) => void;
  setPendingUrl: (url: string | null) => void;
  setToastMessage: (msg: string | null) => void;
  clearToast: () => void;
}

export const useDownloadQueueStore = create<DownloadQueueState>((set) => ({
  jobs: [],
  pendingUrl: null,
  toastMessage: null,

  setJobs: (jobs) => set({ jobs }),

  upsertJob: (job) =>
    set((s) => {
      const idx = s.jobs.findIndex((j) => j.id === job.id);
      if (idx === -1) return { jobs: [...s.jobs, job] };
      const jobs = [...s.jobs];
      jobs[idx] = job;
      return { jobs };
    }),

  setPendingUrl: (pendingUrl) => set({ pendingUrl }),
  setToastMessage: (toastMessage) => set({ toastMessage }),
  clearToast: () => set({ toastMessage: null }),
}));
