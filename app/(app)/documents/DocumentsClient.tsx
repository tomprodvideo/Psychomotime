"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Download,
  FileText,
  Folder,
  FolderPlus,
  Loader2,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";

function isPdf(d: { name: string; mime_type: string | null }) {
  return (
    d.mime_type === "application/pdf" || d.name.toLowerCase().endsWith(".pdf")
  );
}
function isImage(d: { name: string; mime_type: string | null }) {
  return (
    (d.mime_type ?? "").startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(d.name)
  );
}
import { createClient } from "@/lib/supabase/client";
import type { DocFolder, DocumentFile } from "@/lib/types";
import { frDate } from "@/lib/format";

const ALL = "__all__";
const NONE = "__none__";

function uid() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `d${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

function formatBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function DocumentsClient({
  userId,
  folders,
  documents,
}: {
  userId: string;
  folders: DocFolder[];
  documents: DocumentFile[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string>(ALL);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{
    doc: DocumentFile;
    url: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function openPreview(doc: DocumentFile) {
    setError("");
    setPreviewLoading(true);
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 300);
    setPreviewLoading(false);
    if (error || !data) return setError("Ouverture du fichier impossible.");
    setPreview({ doc, url: data.signedUrl });
  }

  const visibleDocs = documents.filter((d) => {
    if (selected === ALL) return true;
    if (selected === NONE) return d.folder_id === null;
    return d.folder_id === selected;
  });

  const targetFolderId =
    selected === ALL || selected === NONE ? null : selected;

  async function createFolder() {
    const { error } = await supabase
      .from("doc_folders")
      .insert({ name: "Nouveau dossier" });
    if (error) return setError(error.message);
    start(() => router.refresh());
  }

  async function saveRename(id: string) {
    const name = renameVal.trim() || "Dossier";
    setRenaming(null);
    const { error } = await supabase
      .from("doc_folders")
      .update({ name })
      .eq("id", id);
    if (error) return setError(error.message);
    start(() => router.refresh());
  }

  async function deleteFolder(id: string) {
    if (
      !confirm(
        "Supprimer ce dossier ? Les fichiers qu'il contient seront déplacés dans « Sans dossier ».",
      )
    )
      return;
    const { error } = await supabase.from("doc_folders").delete().eq("id", id);
    if (error) return setError(error.message);
    if (selected === id) setSelected(ALL);
    start(() => router.refresh());
  }

  async function handleUpload(files: FileList) {
    setError("");
    setUploading(true);
    const MAX = 10 * 1024 * 1024; // 10 Mo
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX) {
          setError(`« ${file.name} » dépasse la limite de 10 Mo.`);
          continue;
        }
        const ext = file.name.includes(".")
          ? file.name.split(".").pop()
          : "bin";
        const path = `${userId}/${uid()}.${ext}`;
        const up = await supabase.storage
          .from("documents")
          .upload(path, file, { upsert: false });
        if (up.error) throw up.error;
        const ins = await supabase.from("documents").insert({
          folder_id: targetFolderId,
          name: file.name,
          storage_path: path,
          mime_type: file.type || null,
          size: file.size,
        });
        if (ins.error) throw ins.error;
      }
      start(() => router.refresh());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Échec de l'envoi. Réessayez.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function download(doc: DocumentFile) {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 120, { download: doc.name });
    if (error || !data) return setError("Téléchargement impossible.");
    window.open(data.signedUrl, "_blank");
  }

  async function deleteDoc(doc: DocumentFile) {
    if (!confirm(`Supprimer « ${doc.name} » ?`)) return;
    await supabase.storage.from("documents").remove([doc.storage_path]);
    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", doc.id);
    if (error) return setError(error.message);
    start(() => router.refresh());
  }

  return (
    <div className="grid md:grid-cols-[240px_1fr] gap-6">
      {/* Dossiers */}
      <div>
        <button
          onClick={createFolder}
          className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg mb-3"
        >
          <FolderPlus className="h-4 w-4" />
          Nouveau dossier
        </button>

        <nav className="space-y-1">
          <FolderRow
            active={selected === ALL}
            onClick={() => setSelected(ALL)}
            label="Tous les documents"
            count={documents.length}
          />
          <FolderRow
            active={selected === NONE}
            onClick={() => setSelected(NONE)}
            label="Sans dossier"
            count={documents.filter((d) => !d.folder_id).length}
          />
          <div className="pt-1 border-t border-slate-100" />
          {folders.map((f) => (
            <div key={f.id}>
              {renaming === f.id ? (
                <div className="flex items-center gap-1 px-1">
                  <input
                    autoFocus
                    value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveRename(f.id)}
                    className="flex-1 rounded border border-slate-200 py-1 px-2 text-sm outline-none focus:border-brand-400"
                  />
                  <button
                    onClick={() => saveRename(f.id)}
                    className="p-1 text-brand-600"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setRenaming(null)}
                    className="p-1 text-slate-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer ${
                    selected === f.id
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                  onClick={() => setSelected(f.id)}
                >
                  <Folder className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-sm truncate">{f.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenaming(f.id);
                      setRenameVal(f.name);
                    }}
                    className="p-0.5 text-slate-400 hover:text-brand-600 md:opacity-0 md:group-hover:opacity-100"
                    title="Renommer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFolder(f.id);
                    }}
                    className="p-0.5 text-slate-400 hover:text-rose-600 md:opacity-0 md:group-hover:opacity-100"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Fichiers */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-sm text-slate-500">
            {visibleDocs.length} fichier{visibleDocs.length > 1 ? "s" : ""}
          </p>
          <label className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg cursor-pointer">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Envoi…" : "Importer un fichier"}
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.odt,.rtf,.txt,.xls,.xlsx,.ppt,.pptx,image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                if (e.target.files?.length) handleUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {error && (
          <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          {visibleDocs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-12">
              Aucun fichier ici. Cliquez sur « Importer un fichier ».
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visibleDocs.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <button
                    onClick={() => openPreview(d)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    title="Ouvrir l'aperçu"
                  >
                    <div className="h-9 w-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate hover:text-brand-700">
                        {d.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatBytes(d.size)} · {frDate(d.created_at)}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => download(d)}
                    className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded"
                    title="Télécharger"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteDoc(d)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {pending && (
          <p className="text-xs text-slate-400 mt-2">Actualisation…</p>
        )}
      </div>

      {/* Aperçu du fichier */}
      {(preview || previewLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-medium text-slate-800 truncate">
                {preview?.doc.name ?? "Chargement…"}
              </p>
              <div className="flex items-center gap-1">
                {preview && (
                  <button
                    onClick={() => download(preview.doc)}
                    className="p-1.5 text-slate-500 hover:text-brand-600"
                    title="Télécharger"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setPreview(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600"
                  title="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-auto">
              {previewLoading || !preview ? (
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              ) : isPdf(preview.doc) ? (
                <iframe
                  src={preview.url}
                  className="w-full h-full"
                  title={preview.doc.name}
                />
              ) : isImage(preview.doc) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.url}
                  alt={preview.doc.name}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-center p-8">
                  <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 mb-4">
                    Aperçu non disponible pour ce type de fichier.
                  </p>
                  <button
                    onClick={() => download(preview.doc)}
                    className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
                  >
                    <Download className="h-4 w-4" />
                    Télécharger
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FolderRow({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
        active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="text-xs text-slate-400">{count}</span>
    </button>
  );
}
