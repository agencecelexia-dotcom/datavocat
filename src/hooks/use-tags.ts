"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "datavocat_tags";

type TagsMap = Record<string, string[]>;

function loadTags(): TagsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveTags(tags: TagsMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
}

export function useTags() {
  const [tagsMap, setTagsMap] = useState<TagsMap>({});

  useEffect(() => {
    setTagsMap(loadTags());
  }, []);

  const addTag = useCallback((decisionId: string, tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    setTagsMap((prev) => {
      const current = prev[decisionId] || [];
      if (current.includes(trimmed)) return prev;
      const next = { ...prev, [decisionId]: [...current, trimmed] };
      saveTags(next);
      return next;
    });
  }, []);

  const removeTag = useCallback((decisionId: string, tag: string) => {
    setTagsMap((prev) => {
      const current = prev[decisionId] || [];
      const next = { ...prev, [decisionId]: current.filter((t) => t !== tag) };
      if (next[decisionId].length === 0) delete next[decisionId];
      saveTags(next);
      return next;
    });
  }, []);

  const getTags = useCallback(
    (decisionId: string) => tagsMap[decisionId] || [],
    [tagsMap]
  );

  const getAllTags = useCallback(() => {
    const all = new Set<string>();
    for (const tags of Object.values(tagsMap)) {
      for (const tag of tags) all.add(tag);
    }
    return Array.from(all);
  }, [tagsMap]);

  return { addTag, removeTag, getTags, getAllTags };
}
