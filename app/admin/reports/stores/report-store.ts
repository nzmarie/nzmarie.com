import { create } from 'zustand';
import type { ReportDocumentTree, ReportSuburb } from '@/types/report';

interface ReportStore {
  documents: ReportDocumentTree[];
  suburbs: ReportSuburb[];
  selectedDocId: string | null;
  isSaving: boolean;
  lastSaved: string | null;
  setDocuments: (docs: ReportDocumentTree[]) => void;
  setSuburbs: (suburbs: ReportSuburb[]) => void;
  setSelectedDocId: (id: string | null) => void;
  setIsSaving: (saving: boolean) => void;
  setLastSaved: (time: string | null) => void;
  updateDocument: (id: string, updates: Partial<ReportDocumentTree>) => void;
  removeDocument: (id: string) => void;
}

export const useReportStore = create<ReportStore>((set) => ({
  documents: [],
  suburbs: [],
  selectedDocId: null,
  isSaving: false,
  lastSaved: null,

  setDocuments: (documents) => set({ documents }),
  setSuburbs: (suburbs) => set({ suburbs }),
  setSelectedDocId: (selectedDocId) => set({ selectedDocId }),
  setIsSaving: (isSaving) => set({ isSaving }),
  setLastSaved: (lastSaved) => set({ lastSaved }),

  updateDocument: (id, updates) => set((state) => ({
    documents: state.documents.map((d) =>
      d.id === id ? { ...d, ...updates } : d
    ),
  })),

  removeDocument: (id) => set((state) => ({
    documents: state.documents.filter((d) => d.id !== id),
  })),
}));
