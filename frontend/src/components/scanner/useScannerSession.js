import { useEffect, useRef, useState } from 'react';
import { Api } from '../../api';

export default function useScannerSession(activeSessionId) {
  const [session, setSession] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const markedStudentIdsRef = useRef(new Set());

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        setLoading(true);
        const sessions = await Api.getSessions();
        const target = activeSessionId
          ? sessions.find((item) => item.id === activeSessionId)
          : sessions.find((item) => item.status === 'open');
        if (!target || cancelled) {
          if (!cancelled) setSession(null);
          return;
        }

        const detail = await Api.getSessionDetail(target.id);
        if (cancelled) return;

        const nextRecords = detail.records || [];
        setSession(detail.session);
        setRecords(nextRecords);
        markedStudentIdsRef.current.clear();
        nextRecords.forEach((record) => {
          if (record.status === 'present' || record.status === 'late') {
            const studentId = record.student || record.student_details?.id;
            if (studentId) markedStudentIdsRef.current.add(studentId);
          }
        });
      } catch (error) {
        if (!cancelled) console.error('Failed to init live session:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSession();
    return () => { cancelled = true; };
  }, [activeSessionId]);

  return { session, setSession, records, setRecords, loading, setLoading, markedStudentIdsRef };
}
