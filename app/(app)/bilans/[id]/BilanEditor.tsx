"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  Folder,
  ImagePlus,
  Loader2,
  Mic,
  Plus,
  Save,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type {
  AdaptationFolder,
  AdaptationTemplate,
  Bilan,
  BilanSectionConfig,
  BilanTests,
  MabcScore,
} from "@/lib/types";
import {
  BILAN_META,
  DUNN_BANDS,
  DUNN_TABLES,
  MABC_BLOCK_TITLES,
  MABC_GROUPS,
  PSYCHOMOTOR_TESTS,
  nsColor,
  type MabcRow,
} from "@/lib/constants";
import { frDate } from "@/lib/format";
import { formatAgeAt } from "@/lib/age";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import { saveBilan, deleteBilan } from "../actions";
import { reformulateText } from "../ai-actions";
import { insererAuCurseur } from "@/lib/bilans/insertion";
import {
  mentionProvenance,
  sectionsGenereesNonRetouchees,
  type Provenances,
} from "@/lib/bilans/provenance";
import { useDictation } from "./useDictation";
import { CHAMP } from "@/components/Champ";
import { Dialogue } from "@/components/Dialogue";
import { Bouton } from "@/components/Bouton";

function parseJSON<T>(s: unknown, fallback: T): T {
  try {
    return typeof s === "string" ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

function uid() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().slice(0, 8)
    : `${Date.now()}${Math.floor(Math.random() * 1e4)}`;
}

/** Redimensionne une image et renvoie un data-URL JPEG léger. */
function resizeImage(file: File, maxDim = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("img"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("ctx"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function BilanEditor({
  bilan,
  templates,
  folders,
  sections,
  patientBirthDate,
}: {
  bilan: Bilan;
  templates: AdaptationTemplate[];
  folders?: AdaptationFolder[];
  sections: BilanSectionConfig[];
  patientBirthDate?: string | null;
}) {
  const raw0 = bilan.content ?? {};

  const [title, setTitle] = useState(bilan.title);
  const [patientName, setPatientName] = useState(bilan.patient_name);
  const [bilanDate, setBilanDate] = useState(bilan.bilan_date ?? "");
  const [author, setAuthor] = useState(bilan.author ?? "");
  const [status, setStatus] = useState(bilan.status);

  const [content, setContent] = useState<Record<string, string>>(() => {
    const c = { ...raw0 };
    delete c.__blocks__;
    delete c.__images__;
    delete c.__flags__;
    delete c.__ia__;
    return c;
  });
  const [images, setImages] = useState<Record<string, string[]>>(() =>
    parseJSON(raw0.__images__, {}),
  );

  const flags0 = parseJSON<{ adaptations?: boolean; preconisations?: boolean }>(
    raw0.__flags__,
    {},
  );
  /* LA PROVENANCE DES PARAGRAPHES REFORMULÉS, chargée depuis le bilan.
   * Elle vit dans le même enregistrement que le texte qu'elle décrit, et rend
   * l'annulation durable : elle survit au rechargement, là où l'ancienne
   * mémoire d'annulation était détruite à la première frappe. */
  const [provenances, setProvenances] = useState<Provenances>(() =>
    parseJSON<Provenances>(raw0.__ia__, {}),
  );

  const [adaptationsOn, setAdaptationsOn] = useState(!!flags0.adaptations);
  const [preconisationsOn, setPreconisationsOn] = useState(
    !!flags0.preconisations,
  );

  // Tests (sélection par section)
  const t0: BilanTests = bilan.tests ?? {};
  const [bySection, setBySection] = useState<Record<string, string[]>>(
    () => t0.bySection ?? {},
  );
  const [mabcGroup, setMabcGroup] = useState<1 | 2 | 3 | null>(
    t0.mabc3_group ?? null,
  );
  const [mabcScores, setMabcScores] = useState<Record<string, MabcScore>>(
    t0.mabc3 ?? {},
  );
  const bilanType =
    raw0.__type__ === "sensoriel" ? "sensoriel" : "psychomoteur";
  const [dunnScores, setDunnScores] = useState<Record<string, number>>(
    () => t0.dunn ?? {},
  );

  // Blocs ajoutés à la volée sous une section (titre libre + texte propre).
  const [blocks, setBlocks] = useState<
    Record<string, { id: string; title: string }[]>
  >(() => parseJSON(raw0.__blocks__, {}));

  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiError, setAiError] = useState<Record<string, string>>({});

  // Modèles réutilisables (gérés dans Paramètres › Bilan), partagés par tous
  // les paragraphes et groupés par dossier dans le menu d'insertion.
  const templateList = templates;
  const folderList = folders ?? [];

  const markDirty = () => setDirty(true);

  const update = (key: string, value: string) => {
    setContent((c) => ({ ...c, [key]: value }));
    markDirty();
    /* ÉCRIRE DANS LE CHAMP N'EFFACE PLUS L'ANNULATION. C'était le
     * comportement précédent, et c'était le pire moment pour la retirer :
     * on corrige deux mots d'un texte reformulé, on s'aperçoit que le sens a
     * glissé, et le retour au texte d'origine n'existe plus. La provenance
     * demeure ; la mention dit simplement que le texte a été modifié depuis. */
  };

  /* LE TEXTE S'INSÈRE AU CURSEUR, PLUS EN FIN DE CHAMP.
   *
   * L'insertion concaténait toujours à la fin. Un modèle n'était donc
   * utilisable qu'au tout début d'un paragraphe ou en queue : dès qu'un texte
   * existait, il fallait insérer puis remonter le fragment à la main. Le
   * mécanisme censé faire gagner du temps en reprenait une partie aussitôt.
   *
   * Vaut aussi pour la dictée, qui écrivait pareillement en fin de champ : on
   * ne pouvait pas dicter un complément au milieu d'un paragraphe.
   *
   * On lit la position depuis l'élément RÉELLEMENT focalisé, et seulement s'il
   * s'agit bien du champ visé — sinon on retombe sur l'ancien comportement.
   * Insérer à une position lue sur un autre champ couperait un mot au hasard
   * dans un texte clinique. */
  const insertInto = (key: string, text: string) => {
    /* On lit la position depuis l'élément RÉELLEMENT focalisé, et seulement
     * s'il s'agit bien du champ visé — sinon on ajoute en fin, comme avant.
     * Insérer à une position lue sur un AUTRE champ couperait un mot au hasard
     * dans un texte clinique.
     *
     * Le découpage lui-même vit dans `lib/bilans/insertion.ts` : cet écran
     * n'est pas atteignable sans session, et un calcul de position qui se
     * trompe d'un caractère ne se voit pas. Il s'y vérifie. */
    const actif = document.activeElement;
    const zone =
      actif instanceof HTMLTextAreaElement && actif.dataset.champ === key
        ? actif
        : null;

    setContent((c) => {
      const prev = c[key] ?? "";
      if (!zone) {
        const sep = prev.trim() ? "\n" : "";
        return { ...c, [key]: prev + sep + text };
      }
      const { texte, curseur } = insererAuCurseur(
        prev,
        zone.selectionStart ?? prev.length,
        zone.selectionEnd ?? zone.selectionStart ?? prev.length,
        text,
      );
      /* Le curseur se replace APRÈS ce qu'on vient d'insérer, pour pouvoir
       * continuer à écrire dans la foulée. React réécrit la valeur au rendu
       * suivant : on repositionne ensuite. */
      queueMicrotask(() => {
        zone.focus();
        zone.setSelectionRange(curseur, curseur);
      });
      return { ...c, [key]: texte };
    });
    markDirty();
  };

  const addBlock = (sectionId: string) => {
    setBlocks((b) => ({
      ...b,
      [sectionId]: [...(b[sectionId] ?? []), { id: uid(), title: "" }],
    }));
    markDirty();
  };
  const renameBlock = (sectionId: string, blockId: string, title: string) => {
    setBlocks((b) => ({
      ...b,
      [sectionId]: (b[sectionId] ?? []).map((x) =>
        x.id === blockId ? { ...x, title } : x,
      ),
    }));
    markDirty();
  };
  const removeBlock = (sectionId: string, blockId: string) => {
    setBlocks((b) => ({
      ...b,
      [sectionId]: (b[sectionId] ?? []).filter((x) => x.id !== blockId),
    }));
    setContent((c) => {
      const next = { ...c };
      delete next[`${sectionId}::${blockId}`];
      return next;
    });
    /* LA PROVENANCE PART AVEC LE BLOC.
     *
     * Sans cela elle devenait ORPHELINE : plus aucun champ pour l'afficher,
     * plus aucun geste pour la retirer — et elle conserve le texte d'avant ET
     * le texte généré, réécrits dans le dossier à chaque enregistrement. La
     * praticienne aurait supprimé un bloc en croyant l'avoir supprimé, et son
     * contenu aurait survécu, invisible.
     *
     * Trouvé par la relecture IA clinique. Un mécanisme de traçabilité qui
     * garde ce qu'on a effacé n'est plus une traçabilité, c'est une rétention
     * dont personne n'a décidé. */
    setProvenances((p) => {
      const next = { ...p };
      delete next[`${sectionId}::${blockId}`];
      return next;
    });
    markDirty();
  };

  const toggleSectionTest = (sectionId: string, testId: string) => {
    setBySection((b) => {
      const cur = b[sectionId] ?? [];
      return {
        ...b,
        [sectionId]: cur.includes(testId)
          ? cur.filter((x) => x !== testId)
          : [...cur, testId],
      };
    });
    markDirty();
  };

  const setScore = (key: string, field: "p" | "ns", value: string) => {
    setMabcScores((m) => ({ ...m, [key]: { ...m[key], [field]: value } }));
    markDirty();
  };

  const setDunn = (rowKey: string, col: number) => {
    setDunnScores((d) => ({ ...d, [rowKey]: col }));
    markDirty();
  };

  const addImages = async (sectionId: string, files: FileList) => {
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      try {
        urls.push(await resizeImage(f));
      } catch {
        /* ignore */
      }
    }
    if (urls.length) {
      setImages((im) => ({
        ...im,
        [sectionId]: [...(im[sectionId] ?? []), ...urls],
      }));
      markDirty();
    }
  };
  const removeImage = (sectionId: string, idx: number) => {
    setImages((im) => ({
      ...im,
      [sectionId]: (im[sectionId] ?? []).filter((_, i) => i !== idx),
    }));
    markDirty();
  };

  async function handleReformulate(key: string, sectionTitle: string) {
    const current = content[key] ?? "";
    if (!current.trim() || aiBusy) return;
    setAiBusy(key);
    setAiError((e) => ({ ...e, [key]: "" }));
    const res = await reformulateText(sectionTitle, current);
    setAiBusy(null);
    if (res.error) {
      setAiError((e) => ({ ...e, [key]: res.error! }));
      return;
    }
    /* On CONSIGNE, on ne se contente plus de remplacer. Sans cette trace, le
     * texte sortait ensuite sous la signature de la praticienne sans que rien,
     * ni en base ni à l'écran, ne dise qu'un modèle l'avait écrit. */
    setProvenances((p) => ({
      ...p,
      [key]: {
        le: new Date().toISOString(),
        modele: res.modele ?? "inconnu",
        /* `avant` NE SE RÉÉCRIT JAMAIS.
         *
         * Défaut introduit avec cette trace, et trouvé par la relecture IA
         * clinique : à la deuxième reformulation d'une même section, `current`
         * vaut la sortie de la PREMIÈRE. Écrire `avant: current` remplaçait
         * donc les notes d'origine de la praticienne par du texte de modèle,
         * définitivement — et « Revenir au texte d'avant » ramenait à une
         * reformulation, sous une mention qui ne le disait pas.
         *
         * Deux clics sur un bouton présenté comme réversible détruisaient la
         * seule chose que ce mécanisme prétend protéger. */
        avant: p[key]?.avant ?? current,
        apres: res.text!,
      },
    }));
    setContent((c) => ({ ...c, [key]: res.text! }));
    markDirty();
  }

  /** Revenir au texte d'avant. Possible tant que la provenance est là. */
  function handleUndo(key: string) {
    const p = provenances[key];
    if (!p) return;
    setContent((c) => ({ ...c, [key]: p.avant }));
    setProvenances((tout) => {
      const reste = { ...tout };
      delete reste[key];
      return reste;
    });
    markDirty();
  }

  /* La dictée passe par le même chemin que les modèles : elle écrit au
   * curseur. Elle concaténait elle aussi en fin de champ — on ne pouvait donc
   * pas dicter un complément au milieu d'un paragraphe déjà écrit. */
  const dictation = useDictation((text, id) => insertInto(id, text));

  /* Une référence, pas la fonction elle-même : `doSave` est recréée à chaque
   * rendu, et l'effet périodique redémarrerait son minuteur à chaque frappe —
   * l'enregistrement n'arriverait donc jamais. */
  const doSaveRef = useRef<(() => void) | null>(null);

  const doSave = (newStatus?: string) =>
    start(async () => {
      const fd = new FormData();
      fd.set("id", bilan.id);
      fd.set("patient_id", bilan.patient_id ?? "");
      fd.set("patient_name", patientName);
      fd.set("title", title);
      fd.set("bilan_date", bilanDate);
      fd.set("author", author);
      fd.set("status", newStatus ?? status);
      fd.set(
        "content",
        JSON.stringify({
          ...content,
          __images__: JSON.stringify(images),
          __blocks__: JSON.stringify(blocks),
          __flags__: JSON.stringify({
            adaptations: adaptationsOn,
            preconisations: preconisationsOn,
          }),
          __ia__: JSON.stringify(provenances),
        }),
      );
      fd.set(
        "tests",
        JSON.stringify({
          bySection,
          mabc3_group: mabcGroup,
          mabc3: mabcScores,
          dunn: dunnScores,
        }),
      );
      const res = await saveBilan(fd);
      if (!res.ok) {
        // Le bilan n'est PAS enregistré. Le dire, et ne surtout pas effacer
        // l'indicateur « modifications non enregistrées » : c'est le seul
        // signal qui empêche de fermer l'onglet en croyant avoir sauvé.
        setSaveError(res.error);
        setSavedAt(false);
        return;
      }
      setSaveError(null);
      setDirty(false);
      setSavedAt(true);
      setTimeout(() => setSavedAt(false), 2500);
    });

  /* ==========================================================================
   *  NE PAS PERDRE UNE PASSATION SAISIE EN SÉANCE
   * ==========================================================================
   *  Le défaut, documenté § C-7 de la sécurité clinique et jusqu'ici ouvert :
   *  tout l'état de cet éditeur vivait dans la mémoire du navigateur et n'était
   *  écrit qu'au clic sur « Enregistrer ». Aucune sauvegarde périodique, aucun
   *  garde-fou à la fermeture de l'onglet. Une passation prise pendant la
   *  séance — le moment où l'on tape vite, où l'on est interrompu, où l'enfant
   *  attend — pouvait disparaître entièrement.
   *
   *  DEUX FILETS, ET AUCUN NE STOCKE AILLEURS.
   *
   *  On aurait pu écrire un brouillon dans le navigateur. On ne le fait PAS :
   *  ce serait déposer des notes cliniques dans le stockage local d'un poste
   *  parfois partagé, qui survit à la déconnexion et que rien n'efface. La
   *  sauvegarde va donc là où la donnée est DÉJÀ — le serveur — et n'ouvre
   *  aucun nouvel endroit où des notes pourraient rester.
   */

  /** Le libellé lisible d'une clé de section ou de bloc. */
  function titreDeSection(cle: string): string {
    const [sectionId, blockId] = cle.split("::");
    if (blockId) {
      const bl = (blocks[sectionId] ?? []).find((b) => b.id === blockId);
      if (bl?.title) return bl.title;
    }
    const s = sections.find((x) => x.id === sectionId);
    return s?.title ?? cle;
  }

  /* La référence est tenue à jour APRÈS le rendu, jamais pendant : écrire une
   * référence en cours de rendu rend le résultat dépendant du moment où React
   * choisit de le produire. */
  useEffect(() => {
    doSaveRef.current = () => doSave();
  });

  /* 1. Enregistrement périodique, tant qu'il y a des modifications en attente.
   *    Trente secondes : assez rare pour ne pas peser, assez fréquent pour que
   *    ce qu'on perd tienne dans ce qu'on se rappelle avoir écrit. */
  useEffect(() => {
    if (!dirty || pending) return;
    /* SEULEMENT UN BROUILLON. Un bilan finalisé se modifie déjà sans laisser de
     * trace — c'est le § C-4, ouvert — et l'enregistrer TOUT SEUL aggraverait
     * franchement les choses : le document remis changerait sans que personne
     * n'ait cliqué. Pour celui-là, l'avertissement à la fermeture reste, et
     * l'enregistrement demande un geste. */
    if (status !== "brouillon") return;
    const t = setTimeout(() => doSaveRef.current?.(), 30_000);
    return () => clearTimeout(t);
  }, [dirty, pending, status]);

  /* 2. Un avertissement à la fermeture, quand il reste des modifications.
   *    C'est le dernier rempart, et le seul qui couvre la fermeture brutale de
   *    l'onglet — le navigateur n'attendra aucune requête à ce moment-là. */
  useEffect(() => {
    if (!dirty) return;
    const avertir = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, [dirty]);

  const group = MABC_GROUPS.find((g) => g.group === mabcGroup) ?? null;

  /** Champ texte réutilisable (section principale ou bloc), avec dictée + IA. */
  function TextField({
    fieldKey,
    label,
    hint,
    rows = 3,
    onRemove,
    extraActions,
  }: {
    fieldKey: string;
    label: string;
    hint?: string;
    rows?: number;
    onRemove?: () => void;
    extraActions?: React.ReactNode;
  }) {
    const busy = aiBusy === fieldKey;
    const hasText = (content[fieldKey] ?? "").trim() !== "";
    const recording = dictation.activeId === fieldKey;
    const otherRecording =
      dictation.activeId !== null && dictation.activeId !== fieldKey;

    /* LES DEUX MOTIFS ÉTAIENT DANS UN `title`, SUR UN BOUTON `disabled`.
       « Dictée non disponible (utilisez Chrome ou Safari) » et « Écrivez
       d'abord » : ni le clavier, ni le doigt, ni un lecteur d'écran ne
       pouvaient les atteindre. Ils sont calculés ici une seule fois, et servent
       à la fois au motif annoncé et à l'infobulle — qui, sur un bouton
       `aria-disabled`, reçoit enfin les événements du pointeur.

       `busy` n'est PAS l'attente de la dictée : c'est une reformulation qui
       réécrit la section. Pour « Dicter », c'est donc un empêchement. */
    const motifDictee = !dictation.supported
      ? "La dictée n'est pas disponible dans ce navigateur (utilisez Chrome ou Safari)."
      : otherRecording
        ? "Une dictée est déjà en cours dans une autre section."
        : busy
          ? "Une reformulation réécrit cette section en ce moment."
          : null;
    const motifReformulation = busy
      ? null
      : !hasText
        ? "Écrivez d'abord le texte à reformuler."
        : aiBusy !== null
          ? "Une reformulation est déjà en cours dans une autre section."
          : null;
    return (
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <label className="block text-sm font-medium text-slate-700">
            {label}
          </label>
          <div className="flex items-center gap-1.5 shrink-0">
            <Bouton
              variante="libre"
              onClick={() => dictation.toggle(fieldKey)}
              /* Masqué : ce bouton se répète à chaque section du bilan. */
              motifMasque
              empeche={motifDictee}
              title={motifDictee ?? "Dicter à la voix"}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition ${
                recording
                  ? "bg-rose-100 text-rose-700 animate-pulse"
                  : "text-slate-600 bg-slate-100 hover:bg-slate-200"
              }`}
            >
              {recording ? (
                <Square className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Mic className="h-3.5 w-3.5" />
              )}
              {recording ? "Stop" : "Dicter"}
            </Bouton>
            <Bouton
              variante="libre"
              onClick={() => handleReformulate(fieldKey, label)}
              pending={busy}
              /* Un NŒUD, pas une phrase seule : l'indicateur animé fait partie
                 de ce qu'on lit pendant la reformulation. */
              pendingLabel={
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Reformulation…
                </>
              }
              motifMasque
              empeche={motifReformulation}
              title={motifReformulation ?? "Reformuler avec l'IA"}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-full transition"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Reformuler
            </Bouton>
            <TemplatesMenu
              templates={templateList}
              folders={folderList}
              onInsert={(t) => insertInto(fieldKey, t)}
            />
            {extraActions}
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                title="Supprimer ce bloc"
                className="p-1 text-slate-500 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <textarea
          data-champ={fieldKey}
          value={content[fieldKey] ?? ""}
          onChange={(e) => update(fieldKey, e.target.value)}
          placeholder={hint}
          rows={rows}
          disabled={busy}
          className="w-full rounded-lg border border-slate-500 bg-slate-50/50 py-2 px-3 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 transition resize-y leading-relaxed disabled:opacity-60"
        />
        {aiError[fieldKey] && (
          <p className="text-xs text-rose-600 mt-1">{aiError[fieldKey]}</p>
        )}
        {provenances[fieldKey] && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {/* LA MENTION DIT CE QUI S'EST PASSÉ, PAS CE QU'IL FAUT EN PENSER.
                Elle ne prétend pas que le texte a été relu : le produit sait
                qu'un modèle l'a écrit, pas qu'il a été jugé juste. */}
            <span className="inline-flex items-center gap-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {mentionProvenance(provenances[fieldKey], content[fieldKey] ?? "")}
            </span>
            <button
              type="button"
              onClick={() => handleUndo(fieldKey)}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700"
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
              Revenir au texte d&apos;avant
            </button>
          </div>
        )}
      </div>
    );
  }

  /** Sélecteur de tests + tableaux M-ABC3 d'une section (domaines). */
  function SectionTests({
    sectionId,
    mabcBlocks,
  }: {
    sectionId: string;
    mabcBlocks?: ("equilibre" | "oculo" | "dexterite")[];
  }) {
    const sel = bySection[sectionId] ?? [];
    const showMabc =
      sel.includes("mabc3") && mabcBlocks && mabcBlocks.length > 0;
    return (
      <div className="mt-3 bg-slate-50/60 rounded-lg p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 mr-1">
            Tests utilisés :
          </span>
          {PSYCHOMOTOR_TESTS.map((t) => {
            const on = sel.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleSectionTest(sectionId, t.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition ${
                  on
                    ? "bg-brand-600 border-brand-600 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:border-brand-300"
                }`}
              >
                {on ? "✓ " : ""}
                {t.label}
              </button>
            );
          })}
        </div>

        {showMabc && (
          <div className="mt-3 border-t border-slate-200 pt-3">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs font-medium text-slate-700">
                M-ABC3 — groupe d&apos;âge :
              </span>
              {MABC_GROUPS.map((g) => (
                <button
                  key={g.group}
                  type="button"
                  onClick={() => {
                    setMabcGroup(g.group);
                    markDirty();
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                    mabcGroup === g.group
                      ? "bg-brand-50 border-brand-400 text-brand-700 ring-1 ring-brand-200"
                      : "border-slate-200 text-slate-500 hover:border-brand-300"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            {group ? (
              mabcBlocks!.map((bk) => (
                <MabcTable
                  key={bk}
                  title={MABC_BLOCK_TITLES[bk]}
                  rows={group.blocks[bk]}
                  scores={mabcScores}
                  onChange={setScore}
                />
              ))
            ) : (
              <p className="text-sm text-slate-500">
                Choisissez un groupe d&apos;âge pour afficher les épreuves.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  /** Photos d'une section. */
  function SectionPhotos({ sectionId }: { sectionId: string }) {
    const imgs = images[sectionId] ?? [];
    return (
      <div className="mt-3 space-y-3">
        {imgs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {imgs.map((src, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="h-24 w-24 object-cover rounded-lg border border-slate-200"
                />
                <button
                  type="button"
                  onClick={() => removeImage(sectionId, i)}
                  className="absolute -top-2 -right-2 bg-white border border-slate-200 rounded-full p-0.5 text-slate-500 hover:text-rose-600 shadow"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg cursor-pointer">
          <ImagePlus className="h-3.5 w-3.5" />
          Ajouter une photo
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addImages(sectionId, e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    );
  }

  /** Blocs ajoutés à la volée (sous-titre libre + texte), remplissables par modèle. */
  function SectionBlocks({ sectionId }: { sectionId: string }) {
    const list = blocks[sectionId] ?? [];
    return (
      <div className="mt-3 space-y-3">
        {list.map((bl) => (
          <div
            key={bl.id}
            className="pl-3 border-l-2 border-brand-100 bg-slate-50/40 rounded-r-lg py-2 pr-2"
          >
            <div className="flex items-center gap-2 mb-1">
              <input
                value={bl.title}
                onChange={(e) => renameBlock(sectionId, bl.id, e.target.value)}
                placeholder="Titre du bloc (sous-titre)"
                className="flex-1 rounded-md border border-slate-500 py-1 px-2 text-sm font-medium italic text-slate-700 outline-none focus:border-brand-400"
              />
              <button
                type="button"
                onClick={() => removeBlock(sectionId, bl.id)}
                title="Supprimer ce bloc"
                className="p-1 text-slate-500 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {TextField({
              fieldKey: `${sectionId}::${bl.id}`,
              label: "",
              hint: "Texte du bloc…",
              rows: 3,
            })}
          </div>
        ))}
        <button
          type="button"
          onClick={() => addBlock(sectionId)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter un bloc
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto pb-40">
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/bilans"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Bilans
        </Link>
        <ConfirmDeleteButton
          id={bilan.id}
          action={deleteBilan}
          message="Supprimer définitivement ce bilan ?"
        />
      </div>

      {/* En-tête éditable */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-5">
        <span
          className={`inline-block text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded mb-2 ${
            raw0.__type__ === "sensoriel"
              ? "bg-indigo-50 text-indigo-600"
              : "bg-teal-50 text-teal-700"
          }`}
        >
          {raw0.__type__ === "sensoriel"
            ? "Bilan sensoriel"
            : "Bilan psychomoteur"}
        </span>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            markDirty();
          }}
          className="w-full text-xl font-semibold text-slate-800 outline-none border-b border-transparent focus:border-brand-300 pb-1"
        />
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <div>
            <Label>Patient (Prénom Nom)</Label>
            <input
              value={patientName}
              onChange={(e) => {
                setPatientName(e.target.value);
                markDirty();
              }}
              className={CHAMP}
            />
            {/* L'ÉTAT DU RATTACHEMENT, ÉCRIT — et pas seulement l'absence de
                ce qui en découle. Sans dossier, l'éditeur ne manquait de rien
                à l'écran : il n'y avait RIEN DU TOUT, ni date de naissance, ni
                âge, ni prescripteur, et l'aperçu les laissait tomber en
                silence sur le document remis.
                Le vocabulaire est celui, déjà validé, de l'écran de création.
                Relevé par la relecture du moteur de bilans. */}
            {!bilan.patient_id && (
              <p className="text-xs text-amber-700 mt-1">
                Ce bilan n&apos;est rattaché à aucun dossier. Il n&apos;apparaît
                pas dans une fiche patient, et le compte rendu sortira sans date
                de naissance, sans âge et sans prescripteur.
              </p>
            )}
            {patientBirthDate && (
              <p className="text-xs text-slate-500 mt-1">
                Né(e) le {frDate(patientBirthDate)} ·{" "}
                {/* Âge À LA DATE DU BILAN saisie juste à côté, pas aujourd'hui :
                    c'est cet âge-là qui décide de la tranche d'un instrument, et
                    l'écran doit montrer celui sur lequel on travaille. */}
                {bilanDate
                  ? `${formatAgeAt(patientBirthDate, bilanDate)} à la date du bilan`
                  : formatAgeAt(patientBirthDate, new Date())}
              </p>
            )}
          </div>
          <div>
            <Label>Date du bilan</Label>
            <input
              type="date"
              value={bilanDate}
              onChange={(e) => {
                setBilanDate(e.target.value);
                markDirty();
              }}
              className={CHAMP}
            />
          </div>
          <div>
            <Label>Rédigé par</Label>
            <input
              value={author}
              onChange={(e) => {
                setAuthor(e.target.value);
                markDirty();
              }}
              className={CHAMP}
            />
          </div>
          <div>
            <Label>Lieu (« Fait à… »)</Label>
            <input
              value={content.lieu ?? ""}
              onChange={(e) => update("lieu", e.target.value)}
              placeholder="Ex. Le Puy-en-Velay"
              className={CHAMP}
            />
          </div>
        </div>
      </div>

      {/* Informations */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-600 mb-3">
          Informations (en-tête du bilan)
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {BILAN_META.map((f) => (
            <div key={f.id}>
              <Label>{f.label}</Label>
              <input
                value={content[f.id] ?? ""}
                onChange={(e) => update(f.id, e.target.value)}
                placeholder={f.placeholder}
                className={CHAMP}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Sections rédigées (trame personnalisable dans Paramètres › Bilan) */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-600 mb-2 px-1">
          Sections du bilan
        </h2>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-100">
          {sections.map((s) => (
            <div
              key={s.id}
              className={`p-4 ${
                s.level === "subtitle"
                  ? "pl-8 border-l-2 border-brand-100 bg-slate-50/40"
                  : ""
              }`}
            >
              {s.kind === "scores" ? (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    {s.title}
                  </p>
                  {bilanType === "sensoriel" ? (
                    DUNN_TABLES.map((tbl) => (
                      <div key={tbl.key} className="mb-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                          {tbl.title}
                        </p>
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full text-xs min-w-[580px]">
                            <thead>
                              <tr className="bg-slate-100 text-encre-faible">
                                <th className="px-2 py-1.5 text-left font-semibold">
                                  Par rapport à la moyenne
                                </th>
                                {DUNN_BANDS.map((band) => (
                                  <th
                                    key={band}
                                    className="px-1 py-1.5 text-center font-medium w-[15%]"
                                  >
                                    {band}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {tbl.rows.map((r) => (
                                <tr
                                  key={r.key}
                                  className="border-t border-slate-100"
                                >
                                  <td className="px-2 py-1.5 align-top">
                                    <span className="font-medium text-slate-700">
                                      {r.label}
                                    </span>
                                    {r.desc && (
                                      <span className="block text-slate-500 text-[10px] leading-tight">
                                        {r.desc}
                                      </span>
                                    )}
                                  </td>
                                  {DUNN_BANDS.map((_, i) => (
                                    <td
                                      key={i}
                                      className="px-1 py-1.5 text-center"
                                    >
                                      <input
                                        type="radio"
                                        name={`dunn_${r.key}`}
                                        checked={dunnScores[r.key] === i}
                                        onChange={() => setDunn(r.key, i)}
                                        className="h-4 w-4 text-brand-600 focus:ring-brand-400 cursor-pointer"
                                      />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">
                      Section générée automatiquement (interprétation des scores +
                      courbe de Gauss). Elle apparaît dès qu&apos;un test est
                      renseigné — rien à saisir ici.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {TextField({
                    fieldKey: s.id,
                    label: s.title,
                    hint: s.hint,
                    rows: s.id === "anamnese" || s.id === "conclusion" ? 6 : 3,
                  })}
                  {s.domain &&
                    SectionTests({ sectionId: s.id, mabcBlocks: s.mabcBlocks })}
                  {SectionBlocks({ sectionId: s.id })}
                  {SectionPhotos({ sectionId: s.id })}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Paragraphes optionnels après la conclusion */}
      <div className="mt-6 bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-600">
          Paragraphes optionnels (après la conclusion)
        </h2>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={adaptationsOn}
            onChange={(e) => {
              setAdaptationsOn(e.target.checked);
              markDirty();
            }}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
          />
          Ajouter un paragraphe « Adaptations »
        </label>
        {adaptationsOn &&
          TextField({
            fieldKey: "adaptations",
            label: "Adaptations",
            hint: "Adaptations à mettre en place au quotidien et en contexte scolaire…",
            rows: 4,
          })}

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={preconisationsOn}
            onChange={(e) => {
              setPreconisationsOn(e.target.checked);
              markDirty();
            }}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
          />
          Ajouter un paragraphe « Préconisations »
        </label>
        {preconisationsOn &&
          TextField({
            fieldKey: "preconisations",
            label: "Préconisations",
            hint: "Préconisations, orientations, suivi conseillé…",
            rows: 4,
          })}
      </div>

      {/* Espace de sécurité sous le dernier bloc (barre d'actions fixe) */}
      <div aria-hidden className="h-24" />

      {/* Barre d'actions fixe */}
      <div className="fixed bottom-0 inset-x-0 md:left-64 bg-white/90 backdrop-blur border-t border-slate-200 px-4 py-3 no-print">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => {
                const next = status === "finalisé" ? "brouillon" : "finalisé";
                /* AVANT DE FINALISER, RECONNAÎTRE CE QUI A ÉTÉ ÉCRIT PAR
                 * L'ASSISTANT ET NON RETOUCHÉ.
                 *
                 * C'est le troisième tiers de la règle absolue n° 5 —
                 * « exiger une validation humaine avant partage ou inscription
                 * définitive » — et il n'était pas même amorcé : le chemin
                 * reformuler → enregistrer → finaliser → imprimer se parcourait
                 * sans un seul geste reconnaissant qu'un modèle avait écrit.
                 *
                 * On ne demande PAS de « valider » : le produit n'est pas en
                 * position de dire qu'un texte est juste. On demande de
                 * confirmer l'avoir relu, et on nomme les sections concernées —
                 * sans quoi la question n'aurait aucun contenu. Une section
                 * retouchée depuis la reformulation n'est pas listée : la
                 * praticienne y est déjà passée. */
                if (next === "finalisé") {
                  const intactes = sectionsGenereesNonRetouchees(
                    provenances,
                    content,
                  ).map(titreDeSection);
                  if (intactes.length > 0) {
                    const ok = window.confirm(
                      "Ces sections sont telles que l'assistant les a écrites, " +
                        "sans modification de votre part :\n\n" +
                        intactes.map((t) => `  • ${t}`).join("\n") +
                        "\n\nConfirmez-vous les avoir relues ?",
                    );
                    if (!ok) return;
                  }
                }
                setStatus(next);
                doSave(next);
              }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                status === "finalisé"
                  ? "bg-brand-100 text-brand-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {status === "finalisé" ? "● Finalisé" : "○ Brouillon"}
            </button>
            {/* « Ma note est-elle sauvée ? » est la question la plus
                importante de cet écran, et elle n'était annoncée à aucun
                lecteur d'écran : un `span` nu, qui plus est effacé au bout de
                deux secondes et demie. `role="status"` la rend audible sans
                interrompre la frappe. */}
            <span
              role="status"
              className={`text-xs ${
                saveError ? "text-red-600 font-medium" : "text-slate-500"
              }`}
            >
              {saveError
                ? "Non enregistré"
                : savedAt
                  ? "Enregistré ✓"
                  : dirty
                    ? "Modifications non enregistrées"
                    : ""}
            </span>
          </div>
          {saveError && (
            <p
              role="alert"
              className="w-full order-first rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200"
            >
              {saveError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Link
              href={`/bilans/${bilan.id}/apercu`}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-lg"
            >
              <Eye className="h-4 w-4" />
              Aperçu / PDF
            </Link>
            <Bouton variante="libre"
              onClick={() => doSave()}
              pending={pending}
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              {savedAt ? (
                <Check className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {pending ? "Enregistrement en cours…" : "Enregistrer"}
            </Bouton>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Menu « Modèles » groupé par dossier (composant stable, au niveau module). */
function TemplatesMenu({
  templates,
  folders,
  onInsert,
}: {
  templates: AdaptationTemplate[];
  folders: AdaptationFolder[];
  onInsert: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);

  const folderIds = new Set(folders.map((f) => f.id));
  const general = templates.filter((t) => !t.folder || !folderIds.has(t.folder));
  const groups = [
    ...folders.map((f) => ({
      id: f.id,
      name: f.name,
      items: templates.filter((t) => t.folder === f.id),
    })),
    ...(general.length
      ? [{ id: "__general__", name: "Général", items: general }]
      : []),
  ];
  const current = folderId ? groups.find((g) => g.id === folderId) ?? null : null;

  const openModal = () => {
    setFolderId(null);
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title="Insérer un modèle"
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full transition"
      >
        Modèles
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        /* LA SECONDE DES DEUX FENÊTRES QUI CONTOURNAIENT `Dialogue` : un
           `fixed inset-0` fermé au clic de fond, sans `role="dialog"`, sans
           piégeage du focus, sans `Escape`, sans restitution du focus. Le
           clavier continuait de circuler derrière la couche opaque, dans
           l'éditeur de bilan.
           Relevé par la relecture d'interface du lot 8. */
        <Dialogue
          ouvert
          onFermer={() => setOpen(false)}
          taille="petite"
          titre={current ? current.name : "Modèles"}
        >
          <div>
            {current && (
              <div className="px-5 pt-3">
                <button
                  type="button"
                  onClick={() => setFolderId(null)}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-700"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Retour aux dossiers
                </button>
              </div>
            )}

            <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
              {current ? (
                current.items.length === 0 ? (
                  <p className="text-sm text-slate-500 px-5 py-4">
                    Aucun modèle dans ce dossier.
                  </p>
                ) : (
                  current.items.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onInsert(t.text);
                        setOpen(false);
                      }}
                      className="block w-full text-left px-5 py-3 hover:bg-brand-50"
                    >
                      <p className="text-sm font-medium text-slate-700">
                        {t.title || "Sans titre"}
                      </p>
                      <p className="text-xs text-slate-500 whitespace-pre-wrap mt-0.5 leading-relaxed line-clamp-2">
                        {t.text}
                      </p>
                    </button>
                  ))
                )
              ) : groups.length === 0 ? (
                <p className="text-sm text-slate-500 px-5 py-4">
                  Aucun modèle. Créez des dossiers et des modèles dans
                  Paramètres › Bilan › Modèles.
                </p>
              ) : (
                groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setFolderId(g.id)}
                    className="flex items-center gap-2 w-full text-left px-5 py-3 hover:bg-brand-50"
                  >
                    <Folder className="h-4 w-4 text-brand-500 shrink-0" />
                    <span className="flex-1 text-sm font-medium text-slate-700 truncate">
                      {g.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {g.items.length}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  </button>
                ))
              )}
            </div>
          </div>
        </Dialogue>
      )}
    </>
  );
}

function MabcTable({
  title,
  rows,
  scores,
  onChange,
}: {
  title: string;
  rows: MabcRow[];
  scores: Record<string, MabcScore>;
  onChange: (key: string, field: "p" | "ns", value: string) => void;
}) {
  return (
    <div className="mb-4">
      <p className="text-sm font-medium text-slate-700 mb-1.5">{title}</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="bg-slate-100 text-left text-xs text-slate-500 uppercase">
              <th className="px-3 py-2 font-semibold">Épreuve</th>
              <th className="px-3 py-2 font-semibold w-56">Performance</th>
              <th className="px-3 py-2 font-semibold w-24 text-center">N.S</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-700 align-top">
                  {r.epreuve}
                </td>
                <td className="px-2 py-1.5 align-top">
                  <textarea
                    value={scores[r.key]?.p ?? ""}
                    onChange={(e) => onChange(r.key, "p", e.target.value)}
                    placeholder={r.perfHint}
                    rows={2}
                    className="w-full rounded border border-slate-500 py-1 px-2 text-sm outline-none focus:border-brand-400 resize-y leading-snug"
                  />
                </td>
                <td className="px-2 py-1.5 align-top">
                  <input
                    value={scores[r.key]?.ns ?? ""}
                    onChange={(e) => onChange(r.key, "ns", e.target.value)}
                    style={{
                      color: nsColor(scores[r.key]?.ns),
                      fontWeight: scores[r.key]?.ns ? 600 : undefined,
                    }}
                    className="w-full rounded border border-slate-500 py-1 px-2 text-sm text-center outline-none focus:border-brand-400"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-500 mb-1">
      {children}
    </label>
  );
}
