"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

type ResultHandler = (text: string, sectionId: string) => void;

/**
 * Dictée vocale via l'API SpeechRecognition du navigateur (Chrome, Edge, Safari).
 * En français (fr-FR). Une seule section enregistrée à la fois.
 */
export function useDictation(onFinal: ResultHandler) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<any>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) setSupported(false);
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  function toggle(sectionId: string) {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }

    // Stop si déjà en cours sur cette section
    if (activeId === sectionId) {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
      return;
    }

    // Stop d'une éventuelle session précédente
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* ignore */
      }
    }

    const rec = new SR();
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (e: any) => {
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      }
      if (finalText.trim()) onFinalRef.current(finalText.trim(), sectionId);
    };
    rec.onend = () => {
      setActiveId(null);
      recRef.current = null;
    };
    rec.onerror = () => {
      setActiveId(null);
      recRef.current = null;
    };

    recRef.current = rec;
    setActiveId(sectionId);
    try {
      rec.start();
    } catch {
      setActiveId(null);
      recRef.current = null;
    }
  }

  return { activeId, supported, toggle };
}
