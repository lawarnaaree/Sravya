import { describe, it, expect, beforeEach } from "vitest";
import { useDownloadQueueStore } from "@/state/downloadQueue";
import type { DownloadJob } from "@/api";

function makeJob(id: string, progress = 0): DownloadJob {
  return { id, url: `https://yt.test/${id}`, progress, state: "queued" };
}

beforeEach(() => {
  useDownloadQueueStore.setState({
    jobs: [],
    pendingUrl: null,
    toastMessage: null,
  });
});

describe("useDownloadQueueStore — initial state", () => {
  it("has no jobs", () => {
    expect(useDownloadQueueStore.getState().jobs).toHaveLength(0);
  });

  it("has no pending URL", () => {
    expect(useDownloadQueueStore.getState().pendingUrl).toBeNull();
  });

  it("has no toast", () => {
    expect(useDownloadQueueStore.getState().toastMessage).toBeNull();
  });
});

describe("useDownloadQueueStore — setJobs", () => {
  it("replaces the jobs list", () => {
    useDownloadQueueStore.getState().setJobs([makeJob("a"), makeJob("b")]);
    expect(useDownloadQueueStore.getState().jobs).toHaveLength(2);
  });
});

describe("useDownloadQueueStore — upsertJob", () => {
  it("inserts a new job", () => {
    useDownloadQueueStore.getState().upsertJob(makeJob("x"));
    expect(useDownloadQueueStore.getState().jobs).toHaveLength(1);
    expect(useDownloadQueueStore.getState().jobs[0].id).toBe("x");
  });

  it("updates an existing job by id", () => {
    useDownloadQueueStore.getState().upsertJob(makeJob("x", 0));
    useDownloadQueueStore.getState().upsertJob({ ...makeJob("x", 75), state: "downloading" });

    const jobs = useDownloadQueueStore.getState().jobs;
    expect(jobs).toHaveLength(1);
    expect(jobs[0].progress).toBe(75);
    expect(jobs[0].state).toBe("downloading");
  });

  it("does not affect other jobs when updating", () => {
    useDownloadQueueStore.getState().upsertJob(makeJob("a"));
    useDownloadQueueStore.getState().upsertJob(makeJob("b"));
    useDownloadQueueStore.getState().upsertJob({ ...makeJob("a", 50), state: "downloading" });

    const jobs = useDownloadQueueStore.getState().jobs;
    expect(jobs).toHaveLength(2);
    expect(jobs.find((j) => j.id === "b")?.state).toBe("queued");
  });

  it("marks a job as done", () => {
    useDownloadQueueStore.getState().upsertJob(makeJob("z"));
    useDownloadQueueStore.getState().upsertJob({ ...makeJob("z", 100), state: "done" });
    expect(useDownloadQueueStore.getState().jobs[0].state).toBe("done");
  });
});

describe("useDownloadQueueStore — setPendingUrl / clearToast", () => {
  it("sets and clears pending URL", () => {
    useDownloadQueueStore.getState().setPendingUrl("https://yt.test/watch?v=abc");
    expect(useDownloadQueueStore.getState().pendingUrl).toBe("https://yt.test/watch?v=abc");
    useDownloadQueueStore.getState().setPendingUrl(null);
    expect(useDownloadQueueStore.getState().pendingUrl).toBeNull();
  });

  it("sets toast message", () => {
    useDownloadQueueStore.getState().setToastMessage("Download started");
    expect(useDownloadQueueStore.getState().toastMessage).toBe("Download started");
  });

  it("clearToast sets toastMessage to null", () => {
    useDownloadQueueStore.getState().setToastMessage("Done");
    useDownloadQueueStore.getState().clearToast();
    expect(useDownloadQueueStore.getState().toastMessage).toBeNull();
  });
});
