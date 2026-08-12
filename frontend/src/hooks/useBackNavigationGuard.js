import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Traps the browser back/forward buttons while the calling page is mounted.
// Without this, pressing back mid-interview silently unmounts the page
// (leaving media streams/AI sessions dangling) or, from a report page,
// drops the user back into an already-ended session. The page's own
// explicit navigation (a Dashboard/Home button, an End Session confirm)
// becomes the only way to actually leave.
export default function useBackNavigationGuard({ onBack, fallbackTo } = {}) {
  const navigate = useNavigate();
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    // Duplicate the current entry so the first back/forward press lands on
    // this trap instead of actually leaving.
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      // Re-assert our entry to cancel the back/forward navigation itself.
      window.history.pushState(null, '', window.location.href);
      if (onBackRef.current) {
        onBackRef.current();
      } else if (fallbackTo) {
        navigate(fallbackTo, { replace: true });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, fallbackTo]);
}
