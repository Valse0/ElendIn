import { useCallback, useEffect, useState } from 'react';
import type { AnalysisResult, CvDocument } from '../types/index.ts';
import { Footer } from '../components/Footer.tsx';
import { Header } from '../components/Header.tsx';
import { AnalyzePage } from '../pages/AnalyzePage.tsx';
import { Landing } from '../pages/Landing.tsx';
import { ReportPage } from '../pages/ReportPage.tsx';
import PatternWaves from '../components/reactbits/PatternWaves.tsx';

type View = 'home' | 'analyze' | 'report';

const HASH: Record<View, string> = { home: '#/', analyze: '#/analyze', report: '#/report' };

function viewFromHash(hash: string): View {
  if (hash.startsWith('#/analyze')) return 'analyze';
  if (hash.startsWith('#/report')) return 'report';
  return 'home';
}

/**
 * Everything the user provides lives in this component's memory only: the extracted CV, the pasted listing and
 * the result. Nothing is written to storage; closing the tab or pressing "Start over" discards it.
 */
export function App() {
  const [view, setView] = useState<View>(() => (typeof location === 'undefined' ? 'home' : viewFromHash(location.hash)));
  const [cv, setCv] = useState<CvDocument | null>(null);
  const [jobText, setJobText] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const go = useCallback((v: View) => {
    setView(v);
    if (location.hash !== HASH[v]) history.pushState(null, '', HASH[v]);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onPop = () => setView(viewFromHash(location.hash));
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  const reset = useCallback(() => {
    setCv(null);
    setJobText('');
    setResult(null);
  }, []);

  // A report can only be shown while its result is in memory (e.g. not after a reload).
  const shown: View = view === 'report' && !result ? 'analyze' : view;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
        aria-hidden="true"
      >
        <PatternWaves
          color="#3B82F6"
          backgroundColor="#21232E"
          opacity={0.4}
          speed={0.4}
          spacing={28}
          markSize={0.45}
          fade="edges"
          fadeSize={0.25}
          interactive={false}
          style={{ width: '100%', height: '100%' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(33, 35, 46, 0.72)',
          }}
        />
      </div>
      <Header onHome={() => go('home')} onAnalyze={() => go('analyze')} />
      {shown === 'home' && <Landing onStart={() => go('analyze')} />}
      {shown === 'analyze' && (
        <AnalyzePage
          cv={cv}
          setCv={setCv}
          jobText={jobText}
          setJobText={setJobText}
          onResult={(r) => {
            setResult(r);
            go('report');
          }}
          onReset={() => {
            reset();
          }}
        />
      )}
      {shown === 'report' && result && (
        <ReportPage
          result={result}
          onBack={() => go('analyze')}
          onNew={() => {
            reset();
            go('analyze');
          }}
        />
      )}
      <Footer />
    </>
  );
}
