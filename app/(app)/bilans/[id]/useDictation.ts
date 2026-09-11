"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

type ResultHandler = (text: string, sectionId: string) => void;

/** Constructeur SpeechRecognition du navigateur, ou `null` s'il n'existe pas. */
function speechRecognitionCtor(): any {
  if (typeof window === "undefined") return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

/**
 * La disponibilité de l'API ne change jamais pendant la vie de la page :
 * il n'y a donc rien à quoi s'abonner.
 */
const subscribeNothing = () => () => {};

/**
 * Dictée vocale via l'API SpeechRecognition du navigateur (Chrome, Edge, Safari).
 * En français (fr-FR). Une seule section enregistrée à la fois.
 */
export function useDictation(onFinal: ResultHandler) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const onFinalRef = useRef(onFinal);

  // Le gestionnaire est lu par les rappels asynchrones de l'API, longtemps
  // après le rendu. On le rafraîchit dans un effet plutôt que pendant le
  // rendu, qui doit rester sans effet de bord.
  useEffect(() => {
    onFinalRef.current = onFinal;
  });

  // Capacité du navigateur, lue sans passer par un état : au rendu serveur on
  // suppose l'API disponible pour ne pas afficher d'avertissement avant
  // l'hydratation, puis la valeur réelle prend le relais côté client.
  const supported = useSyncExternalStore(
    subscribeNothing,
    () => speechRecognitionCtor() !== null,
    () => true,
  );

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  function toggle(sectionId: string) {
    const SR = speechRecognitionCtor();
    if (!SR) return;

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
