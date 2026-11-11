import { AnalysisError, analyze } from '../engine/analysisEngine.ts';
import type { AnalysisResult, CvDocument } from '../types/index.ts';
import { parseAnalysisResult } from '../types/schemas.ts';
import type { WorkerResponse } from './analysis.worker.ts';

export interface AnalysisHandle {
  promise: Promise<AnalysisResult>;
  /** Stops the work and rejects with AnalysisError('CANCELLED'). */
  cancel(): void;
}

const TIMEOUT_MS = 30_000;

/**
 * Runs the analysis in a Web Worker. If workers are unavailable (very old WebView, strict CSP) it falls
 * back to the main thread after yielding once, so the loading state can still paint.
 */
export function runAnalysis(cv: CvDocument, jobText: string): AnalysisHandle {
  let cancelled = false;
  let worker: Worker | null = null;
  let rejectFn: ((e: unknown) => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (worker) {
      worker.terminate();
      worker = null;
    }
  };

  const promise = new Promise<AnalysisResult>((resolve, reject) => {
    rejectFn = reject;
    const finishOk = (r: AnalysisResult) => {
      cleanup();
      resolve(r);
    };
    const finishErr = (e: unknown) => {
      cleanup();
      reject(e);
    };

    const fallback = () => {
      setTimeout(() => {
        if (cancelled) return;
        try {
          finishOk(analyze(cv, jobText));
        } catch (e) {
          finishErr(e instanceof AnalysisError ? e : new AnalysisError('ANALYSIS_FAILED', e instanceof Error ? e.message : String(e)));
        }
      }, 0);
    };

    if (typeof Worker === 'undefined') return fallback();
    try {
      worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      return fallback();
    }

    timer = setTimeout(() => finishErr(new AnalysisError('ANALYSIS_FAILED', 'timeout')), TIMEOUT_MS);
    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data;
      if (msg.type === 'error') return finishErr(new AnalysisError(msg.code, msg.message));
      const checked = parseAnalysisResult(msg.result);
      if (!checked) return finishErr(new AnalysisError('ANALYSIS_FAILED', 'invalid result shape'));
      finishOk(checked);
    };
    // A worker that cannot start (blocked, 404) must not leave the user waiting for the timeout.
    worker.onerror = () => {
      if (cancelled) return;
      cleanup();
      fallback();
    };
    worker.postMessage({ type: 'analyze', cv, jobText });
  });

  return {
    promise,
    cancel() {
      cancelled = true;
      cleanup();
      rejectFn?.(new AnalysisError('CANCELLED'));
    },
  };
}
