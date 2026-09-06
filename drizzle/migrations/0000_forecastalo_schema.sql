CREATE TABLE public.data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT,
  licence TEXT,
  granularity TEXT,
  update_frequency TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.data_sources TO anon, authenticated;
GRANT ALL ON public.data_sources TO service_role;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read data_sources" ON public.data_sources FOR SELECT USING (true);

CREATE TABLE public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('province','municipality')),
  parent_zone_code TEXT,
  region TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  population INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.zones TO anon, authenticated;
GRANT ALL ON public.zones TO service_role;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read zones" ON public.zones FOR SELECT USING (true);

CREATE TABLE public.indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.data_sources(id) ON DELETE SET NULL,
  indicator_code TEXT NOT NULL,
  period DATE NOT NULL,
  value NUMERIC,
  unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT indicators_unique_zone_code_period UNIQUE (zone_id, indicator_code, period)
);
CREATE INDEX indicators_zone_code_idx ON public.indicators (zone_id, indicator_code);
GRANT SELECT ON public.indicators TO anon, authenticated;
GRANT ALL ON public.indicators TO service_role;
ALTER TABLE public.indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read indicators" ON public.indicators FOR SELECT USING (true);

CREATE TABLE public.forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  indicator_code TEXT NOT NULL,
  horizon_months INTEGER NOT NULL,
  period DATE NOT NULL,
  value_forecast NUMERIC,
  lower_bound NUMERIC,
  upper_bound NUMERIC,
  model_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.forecasts TO anon, authenticated;
GRANT ALL ON public.forecasts TO service_role;
ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read forecasts" ON public.forecasts FOR SELECT USING (true);

CREATE TABLE public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  play TEXT NOT NULL,
  score_total NUMERIC,
  breakdown JSONB,
  recommendation TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX scores_play_total_idx ON public.scores (play, score_total);
GRANT SELECT ON public.scores TO anon, authenticated;
GRANT ALL ON public.scores TO service_role;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read scores" ON public.scores FOR SELECT USING (true);

INSERT INTO public.data_sources (code, name, description, url, granularity, update_frequency) VALUES
('pvgis','PVGIS (JRC)','Photovoltaic yield and solar radiation','https://re.jrc.ec.europa.eu','coordinate','static'),
('istat','ISTAT SDMX','Population, households, buildings and dwellings','https://esploradati.istat.it','municipality','annual'),
('siape','SIAPE ENEA','Energy performance certificates of buildings','https://siape.enea.it','province','annual');
