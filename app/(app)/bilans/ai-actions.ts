"use server";

import Anthropic from "@anthropic-ai/sdk";

// Modèle utilisé pour la reformulation. Opus 4.8 = meilleure qualité rédactionnelle.
// (Pour réduire le coût, remplacer par "claude-sonnet-4-6".)
const MODEL = "claude-opus-4-8";

export interface ReformulateResult {
  text?: string;
  error?: string;
}

export async function reformulateText(
  sectionTitle: string,
  rawText: string,
): Promise<ReformulateResult> {
  const input = (rawText ?? "").trim();
  if (!input) {
    return { error: "Cette section est vide." };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      error:
        "Clé API Anthropic manquante. Ajoutez ANTHROPIC_API_KEY dans la configuration.",
    };
  }

  const client = new Anthropic();

  const system =
    "Tu es psychomotricien(ne) diplômé(e) d'État expérimenté(e). " +
    "Tu reformules des notes brutes prises pendant un bilan psychomoteur en un texte clinique " +
    "professionnel, rédigé à la troisième personne, dans un registre soutenu et bienveillant. " +
    "STYLE : sois SYNTHÉTIQUE et CONCIS. Phrases courtes, vocabulaire précis, va à l'essentiel. " +
    "Supprime les répétitions, le remplissage et les formulations creuses. Le résultat doit être COURT — " +
    "vise un texte plus dense et plus bref que des notes verbeuses, sans jamais perdre d'information factuelle. " +
    "Règles strictes : n'invente aucune information, aucun chiffre, aucun résultat de test ; " +
    "reformule uniquement ce qui est fourni, sans rien ajouter ni interpréter au-delà des notes. " +
    "Conserve toutes les données factuelles (scores, latéralités, durées…). " +
    "N'utilise pas de listes à puces sauf si les notes en contiennent. " +
    "Réponds UNIQUEMENT avec le texte reformulé, sans préambule, sans titre, sans guillemets, sans commentaire.";

  const user =
    `Section du bilan : « ${sectionTitle} ».\n\n` +
    `Notes brutes à reformuler :\n${input}`;

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: user }],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!text) return { error: "Réponse vide du modèle. Réessayez." };
    return { text };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return { error: "Clé API Anthropic invalide." };
    }
    if (e instanceof Anthropic.RateLimitError) {
      return { error: "Trop de requêtes. Patientez quelques secondes." };
    }
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return { error: `Échec de la reformulation : ${msg}` };
  }
}
