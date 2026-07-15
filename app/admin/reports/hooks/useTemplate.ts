import { useState, useCallback } from 'react';
import type { ReportSuburb } from '@/types/report';

export function useTemplate() {
  const [generating, setGenerating] = useState(false);

  const generateReport = useCallback(async (suburbId: string, quarter: string) => {
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/reports/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb_id: suburbId, quarter }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.id as string;
    } finally {
      setGenerating(false);
    }
  }, []);

  const fetchSuburbs = useCallback(async (): Promise<ReportSuburb[]> => {
    const res = await fetch('/api/admin/reports/suburbs');
    const result = await res.json();
    if (!result.success) throw new Error(result.error);
    return result.suburbs;
  }, []);

  return { generateReport, fetchSuburbs, generating };
}
