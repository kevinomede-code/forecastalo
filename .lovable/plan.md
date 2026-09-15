# Meteo in Forecastalo: Xweather (chat) + Open-Meteo (database)

## Obiettivo
Due ruoli separati, come deciso:
- **Xweather** → meteo vivo per la chat: condizioni attuali della zona di cui si parla, richieste solo su richiesta con cache 24h nel database.
- **Open-Meteo** → indicatori climatici storici nel database (mensili, tutte le ~1.290 zone), pronti come futuri fattori di punteggio.
- Nessun punteggio esistente cambia: i fattori restano quelli attuali.

## 1. Database
- Migration (lov_database--migration): due nuove righe in `data_sources`:
  - `xweather` — "Xweather", granularity `coordinate`, update_frequency `hourly`
  - `open_meteo` — "Open-Meteo", granularity `coordinate`, update_frequency `daily`
- Il meteo vive nella tabella `indicators` (vincolo unico zone_id+code+period già presente → upsert):
  - da Xweather (period = oggi): `temp_max_c`, `temp_min_c`, `precip_mm`, `wind_kph`
  - da Open-Meteo (period = primo del mese): `temperature_mean_c`, `heating_degree_days` (base 18), `cooling_degree_days` (base 18), `precipitation_mm`
- Migrazione storica Open-Meteo mensile a partire da 2016 (allineata ai prezzi GME/ENTSO-E).

## 2. Open-Meteo — backfill storico
- `src/lib/weather-backfill.server.ts`: scarica da Open-Meteo Archive API (`archive-api.open-meteo.com`, senza chiave) i dati giornalieri per tutti i comuni+province in batch di coordinate (~50 per richiesta), aggrega a mesi (media temperatura, HDD = max(0, 18 − media), CDD, precipitazioni) e fa upsert in `indicators` con `source_id = open_meteo`.
- Endpoint pubblico protetto `POST /api/public/weather-backfill` con `authenticateCronRequest` (stesso schema di `/api/public/kg-reindex`), parametri `?start=YYYY-MM` e default incrementale (riparte dall'ultimo mese presente). Chiamate batch sequentiali con piccola pausa per rispettare l'API.
- Lancio del backfill a lavoro fatto, verificando il numero di righe inserite.

## 3. Xweather — meteo vivo in chat
- `src/lib/weather.server.ts`: `getLiveWeather(lat, lon, zoneId)` — se esiste già una riga `temp_max_c` di oggi per la zona la riusa (cache implicita via upsert del giorno); altrimenti chiama Xweather `/conditions` (auth basic client_id:client_secret) e fa upsert degli indicatori di oggi.
- `src/lib/ask.functions.ts`: per le zone matchate (max 5 richieste), recupera o aggiorna il meteo del giorno e aggiunge un blocco `weather` al contesto grounded + una riga nel system prompt: "weather = condizioni correnti, utile per la domanda elettrica di breve periodo, non un dato strutturale".
- Il meteo entra così anche automaticamente in `latest_indicators` già usato dal contesto.

## 4. Credenziali (dopo che gli endpoint esistono)
- `add_secret`: `XWEATHER_CLIENT_ID` e `XWEATHER_CLIENT_SECRET` — ti chiederò di registrarli sul piano gratuito di xweather.com (15.000 richieste/mese, sufficienti per il fetch su richiesta). Open-Meteo non richiede nulla.

## 5. Pagina System
- Tabella fonti: righe Open-Meteo e Xweather.
- Known limits: "HDD/CDD mensili calcolati dalla temperatura media giornaliera (base 18°C); il meteo vivo in chat è la condizione corrente Xweather, non uno storico."

## Verifica
- Typecheck + build OK; curl del backfill con verifica righe inserite; domanda in chat su una zona con risposta che cita il meteo corrente; nessun errore in console.
