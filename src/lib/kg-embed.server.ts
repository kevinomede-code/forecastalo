// Semantic layer over the knowledge-graph notes: the numbers stay in Postgres,
// the prose is retrieved by meaning through pgvector.
const EMBEDDING_MODEL = "google/gemini-embedding-2";
const EMBEDDING_ENDPOINT = "https://ai.gateway.lovable.dev/v1/embeddings";
const BATCH_SIZE = 50; // Google caps a batch at 100 inputs.

export function nodeEmbeddingText(node: {
  title: string;
  kind: string;
  summary: string | null;
  detail: string | null;
}): string {
  return [node.title, node.kind, node.summary ?? "", node.detail ?? ""]
    .filter(Boolean)
    .join("\n")
    .slice(0, 12000);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await fetch(EMBEDDING_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Embeddings request failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const json = (await response.json()) as {
      data: Array<{ index: number; embedding: number[] }>;
    };
    const ordered = [...json.data].sort((a, b) => a.index - b.index);
    for (const item of ordered) vectors.push(item.embedding);
  }
  return vectors;
}

export async function embedQuestion(question: string): Promise<number[] | null> {
  try {
    const [vector] = await embedTexts([question]);
    return vector ?? null;
  } catch (error) {
    console.error("[kg-embed] question embedding failed", error);
    return null;
  }
}

export async function reindexKgNodes(options: { force?: boolean } = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let query = supabaseAdmin
    .from("kg_nodes")
    .select("slug, title, kind, summary, detail")
    .order("slug");
  if (!options.force) query = query.is("embedding", null);

  const { data: nodes, error } = await query;
  if (error) throw new Error(error.message);
  if (!nodes || nodes.length === 0) return { embedded: 0, model: EMBEDDING_MODEL };

  const vectors = await embedTexts(nodes.map((node) => nodeEmbeddingText(node)));
  const embedded_at = new Date().toISOString();

  for (const [i, node] of nodes.entries()) {
    const embedding = vectors[i];
    if (!embedding) continue;
    const { error: updateError } = await supabaseAdmin
      .from("kg_nodes")
      .update({
        embedding: JSON.stringify(embedding),
        embedding_model: EMBEDDING_MODEL,
        embedded_at,
      } as never)
      .eq("slug", node.slug);
    if (updateError) throw new Error(`${node.slug}: ${updateError.message}`);
  }

  return { embedded: nodes.length, model: EMBEDDING_MODEL };
}
