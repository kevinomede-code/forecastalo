create extension if not exists vector;

alter table public.kg_nodes
  add column if not exists embedding vector(3072),
  add column if not exists embedding_model text,
  add column if not exists embedded_at timestamptz;

create index if not exists kg_nodes_embedding_idx
  on public.kg_nodes using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

-- Hybrid retrieval: semantic (cosine on embeddings) unioned with the existing
-- keyword ranking, so exact names still win and paraphrases still match.
create or replace function public.kg_search_hybrid(
  q text,
  query_embedding vector(3072),
  max_nodes integer default 6,
  min_similarity double precision default 0.30
)
returns jsonb
language sql
stable
as $function$
  with sem as (
    select n.slug,
           1 - (n.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) as similarity
    from kg_nodes n
    where n.embedding is not null
    order by n.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
    limit max_nodes
  ),
  terms as (
    select array(
      select regexp_replace(w, '[^a-z0-9àèéìòù]', '', 'g')
      from unnest(regexp_split_to_array(lower(coalesce(q,'')), '\s+')) w
      where length(regexp_replace(w, '[^a-z0-9àèéìòù]', '', 'g')) > 3
    ) as ws
  ),
  tsq as (
    select case when array_length(ws,1) is null then null
                else to_tsquery('simple', array_to_string(ws, ' | ')) end as query,
           ws
    from terms
  ),
  kw as (
    select n.slug, ts_rank(to_tsvector('simple',
             n.title||' '||n.summary||' '||coalesce(n.detail,'')), t.query) as rank
    from kg_nodes n, tsq t
    where t.query is not null
      and (to_tsvector('simple', n.title||' '||n.summary||' '||coalesce(n.detail,'')) @@ t.query
           or exists (select 1 from unnest(t.ws) w where n.title ilike '%'||w||'%'))
    order by rank desc nulls last
    limit max_nodes
  ),
  ranked as (
    select coalesce(s.slug, k.slug) as slug,
           s.similarity,
           k.rank as keyword_rank,
           case
             when s.slug is not null and k.slug is not null then 'hybrid'
             when s.slug is not null then 'semantic'
             else 'keyword'
           end as match_type,
           coalesce(s.similarity, 0) * 0.7 + least(coalesce(k.rank, 0), 1) * 0.3 as combined
    from sem s
    full join kw k on k.slug = s.slug
    where s.slug is null or s.similarity >= min_similarity
  ),
  hits as (
    select n.*, r.similarity, r.keyword_rank, r.match_type, r.combined
    from ranked r
    join kg_nodes n on n.slug = r.slug
    order by r.combined desc
    limit max_nodes
  ),
  neigh as (
    select distinct n2.slug, n2.title, n2.kind, n2.summary, e.relation
    from hits h
    join kg_edges e on e.source_slug = h.slug or e.target_slug = h.slug
    join kg_nodes n2 on n2.slug = case when e.source_slug = h.slug
                                       then e.target_slug else e.source_slug end
    where n2.slug not in (select slug from hits)
  )
  select jsonb_build_object(
    'matched', coalesce((select jsonb_agg(jsonb_build_object(
        'slug',slug,'title',title,'kind',kind,'summary',summary,'detail',detail,'refs',refs,
        'similarity', round(similarity::numeric, 3), 'match_type', match_type)
        order by combined desc) from hits), '[]'::jsonb),
    'related', coalesce((select jsonb_agg(jsonb_build_object(
        'slug',slug,'title',title,'kind',kind,'summary',summary,'relation',relation))
      from neigh), '[]'::jsonb)
  );
$function$;

grant execute on function public.kg_search_hybrid(text, vector, integer, double precision) to anon, authenticated, service_role;