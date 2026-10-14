import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SignedIn } from '@clerk/clerk-react';
import { ArrowLeft } from 'lucide-react';
import Background from '../components/layout/Background';
import Navbar from '../components/layout/Navbar';
import AppSidebar from '../components/layout/AppSidebar';
import ResearchChat from '../components/research/ResearchChat';
import ApiDebugBanner from '../components/shared/ApiDebugBanner';
import { useSearchHistory } from '../hooks/useSearchHistory';


export default function ResearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || undefined;
  const fallbackContext = searchParams.get('context') || undefined;
  const { history, loading, loadingMore, hasMore, pendingDeleteIds, addEntry, deleteEntry, loadMore } = useSearchHistory();
  const logged = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (initialQuery && !logged.current) {
      logged.current = true;
      void addEntry(initialQuery, 'research');
    }
  }, [initialQuery, addEntry]);

  const handleHistorySelect = (prompt: string, historyMode: string) => {
    if (historyMode === 'research') {
      navigate(`/research?q=${encodeURIComponent(prompt)}`);
    } else if (historyMode === 'quantdocs') {
      navigate(prompt.trim() ? `/quantdocs?question=${encodeURIComponent(prompt)}` : '/quantdocs');
    } else {
      navigate(`/?prompt=${encodeURIComponent(prompt)}`);
    }
  };

  return (
    <>
      <Background />
      <Navbar onToggleSidebar={() => setSidebarOpen((s) => !s)} />
      <ApiDebugBanner />
      <SignedIn>
        <AppSidebar
          open={sidebarOpen}
          history={history}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          pendingDeleteIds={pendingDeleteIds}
          onSelect={handleHistorySelect}
          onDelete={deleteEntry}
          onLoadMore={loadMore}
          onClose={() => setSidebarOpen(false)}
        />
      </SignedIn>
      <main>
        <div className="container" style={{ paddingTop: 12 }}>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="back-button"
            aria-label="Back to home"
          >
            <ArrowLeft size={14} />
            <span>Back to home</span>
          </button>
        </div>
        <ResearchChat
          initialMessage={initialQuery}
          initialContext={fallbackContext}
        />
      </main>
    </>
  );
}
