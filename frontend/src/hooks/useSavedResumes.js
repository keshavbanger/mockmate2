import { useState, useEffect, useCallback } from 'react';
import { listSavedResumes } from '../utils/savedResumeApi';
import { useAuth } from '../context/AuthContext.jsx';

/** Loads the current user's saved resumes; empty/no-op while logged out. */
export function useSavedResumes() {
  const { user } = useAuth();
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(!!user);
  const [error, setError] = useState(null);

  const reload = useCallback(() => {
    if (!user) {
      setResumes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    listSavedResumes()
      .then((data) => setResumes(Array.isArray(data) ? data : []))
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  return { resumes, loading, error, reload };
}
