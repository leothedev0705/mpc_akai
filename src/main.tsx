import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { StudioPage } from '@/pages/StudioPage';
import { useProjectStore } from '@/stores/projectStore';
import { useKeyboardTriggers, useAudioUnlock, useAutoSave } from '@/hooks';
import '@/styles/index.css';

function AppShell() {
  const init = useProjectStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  useKeyboardTriggers();
  useAudioUnlock();
  useAutoSave();

  return (
    <div className="h-full flex flex-col bg-background">
      <Routes>
        <Route path="*" element={<StudioPage />} />
      </Routes>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#171717',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
          },
        }}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  </StrictMode>,
);
