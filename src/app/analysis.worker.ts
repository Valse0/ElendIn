/// <reference lib="webworker" />
import { AnalysisError, analyze } from '../engine/analysisEngine.ts';
import type { AnalysisErrorCode, AnalysisResult, CvDocument } from '../types/index.ts';

/**
 * Runs the (pure, synchronous) analysis engine off the UI thread. The worker never touches the network;
 * it receives the extracted CV text and the pasted listing, and posts back a plain result object.
 */
export interface WorkerRequest {
  type: 'analyze';
  cv: CvDocument;
  jobText: string;
}

export type WorkerResponse =
  | { type: 'result'; result: AnalysisResult }
  | { type: 'error'; code: AnalysisErrorCode; message: string };

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  if (!msg || msg.type !== 'analyze') return;
  try {
    const result = analyze(msg.cv, msg.jobText);
    (self as unknown as Worker).postMessage({ type: 'result', result } satisfies WorkerResponse);
  } catch (e) {
    const code: AnalysisErrorCode = e instanceof AnalysisError ? e.code : 'ANALYSIS_FAILED';
    (self as unknown as Worker).postMessage({ type: 'error', code, message: e instanceof Error ? e.message : String(e) } satisfies WorkerResponse);
  }
};
