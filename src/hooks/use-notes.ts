"use client";

import { useState, useEffect, useCallback } from "react";

export interface NoteItem {
  text: string;
  updatedAt: string;
}

const STORAGE_KEY = "datavocat_notes";

type NotesMap = Record<string, NoteItem[]>;

function loadNotes(): NotesMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveNotes(notes: NotesMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function useNotes() {
  const [notesMap, setNotesMap] = useState<NotesMap>({});

  useEffect(() => {
    setNotesMap(loadNotes());
  }, []);

  const addNote = useCallback((decisionId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setNotesMap((prev) => {
      const current = prev[decisionId] || [];
      const note: NoteItem = { text: trimmed, updatedAt: new Date().toISOString() };
      const next = { ...prev, [decisionId]: [note, ...current] };
      saveNotes(next);
      return next;
    });
  }, []);

  const deleteNote = useCallback((decisionId: string, index: number) => {
    setNotesMap((prev) => {
      const current = prev[decisionId] || [];
      const next = { ...prev, [decisionId]: current.filter((_, i) => i !== index) };
      if (next[decisionId].length === 0) delete next[decisionId];
      saveNotes(next);
      return next;
    });
  }, []);

  const getNotes = useCallback(
    (decisionId: string): NoteItem[] => notesMap[decisionId] || [],
    [notesMap]
  );

  return { addNote, deleteNote, getNotes };
}
