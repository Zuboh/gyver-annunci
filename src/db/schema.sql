-- Annunci schema (SPEC "Schema dati"). Idempotent: applied on every openDatabase().
-- Conventions:
--   ids are TEXT (slugs for job offers and channels, generated ids elsewhere: see ids.ts)
--   timestamps are ISO-8601 UTC TEXT, e.g. 2026-11-09T12:00:00.000Z
--   JSON columns are TEXT checked with json_valid; booleans are INTEGER 0/1
--   no physical deletes of ads, variants, versions; versions are append-only

-- Job Offer: external input, read-only. Query-useful columns + full payload.
CREATE TABLE IF NOT EXISTS job_offers (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  company_name TEXT NOT NULL,
  status       TEXT NOT NULL,
  payload      TEXT NOT NULL CHECK (json_valid(payload) AND json_type(payload) = 'object'),
  CHECK (json_extract(payload, '$.job_offer_id') = id)
);

-- Brief: publishable facts of a Job Offer. Regenerating appends a row; latest = in use.
CREATE TABLE IF NOT EXISTS briefs (
  id             TEXT PRIMARY KEY,
  job_offer_id   TEXT NOT NULL REFERENCES job_offers (id),
  content        TEXT NOT NULL CHECK (json_valid(content) AND json_type(content) = 'object'),
  model          TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS briefs_job_offer_latest ON briefs (job_offer_id, created_at);

-- Channel: data, not enum (ADR 0001). kind selects the content schema in code.
CREATE TABLE IF NOT EXISTS channels (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('job_board', 'social_ad', 'messaging')),
  tone_guidelines TEXT NOT NULL
);

-- Channel × Format allowed, with its constraints (ChannelFormatConstraints JSON).
CREATE TABLE IF NOT EXISTS channel_formats (
  channel_id  TEXT NOT NULL REFERENCES channels (id),
  format      TEXT NOT NULL CHECK (format IN ('text', 'image', 'image_text')),
  constraints TEXT NOT NULL CHECK (json_valid(constraints) AND json_type(constraints) = 'object'),
  PRIMARY KEY (channel_id, format)
);

-- Ad: one Channel, one Format, one Location. The composite FK makes an
-- unsupported Channel × Format impossible to store.
CREATE TABLE IF NOT EXISTS ads (
  id                     TEXT PRIMARY KEY,
  job_offer_id           TEXT NOT NULL REFERENCES job_offers (id),
  channel_id             TEXT NOT NULL,
  format                 TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'ready', 'published', 'paused', 'archived')),
  location_label         TEXT NOT NULL CHECK (length(trim(location_label)) > 0),
  location_municipality  TEXT,
  location_province      TEXT,
  location_province_code TEXT CHECK (location_province_code IS NULL OR length(location_province_code) = 2),
  location_region        TEXT,
  location_country       TEXT NOT NULL DEFAULT 'IT' CHECK (length(location_country) = 2),
  created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- set explicitly by every UPDATE of the row
  updated_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (channel_id, format) REFERENCES channel_formats (channel_id, format)
);
CREATE INDEX IF NOT EXISTS ads_job_offer_id ON ads (job_offer_id);
CREATE INDEX IF NOT EXISTS ads_channel_id ON ads (channel_id);
CREATE INDEX IF NOT EXISTS ads_status ON ads (status);

-- Variant: one alternative of an Ad (text + Creative together), pointing at an angle.
CREATE TABLE IF NOT EXISTS variants (
  id         TEXT PRIMARY KEY,
  ad_id      TEXT NOT NULL REFERENCES ads (id),
  label      TEXT NOT NULL CHECK (length(label) = 1 AND label GLOB '[A-Z]'),
  angle      TEXT NOT NULL CHECK (length(trim(angle)) > 0),
  active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (ad_id, label)
);

-- Version: immutable content of a Variant (ADR 0002). Current = highest number.
-- LLM Versions carry their provenance; manual Versions carry none.
CREATE TABLE IF NOT EXISTS versions (
  id             TEXT PRIMARY KEY,
  variant_id     TEXT NOT NULL REFERENCES variants (id),
  number         INTEGER NOT NULL CHECK (number >= 1),
  content        TEXT NOT NULL CHECK (json_valid(content) AND json_type(content) = 'object'),
  origin         TEXT NOT NULL CHECK (origin IN ('llm', 'manual')),
  brief_id       TEXT REFERENCES briefs (id),
  model          TEXT,
  prompt_version TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (variant_id, number),
  CHECK (
    (origin = 'llm' AND brief_id IS NOT NULL AND model IS NOT NULL AND prompt_version IS NOT NULL)
    OR (origin = 'manual' AND brief_id IS NULL AND model IS NULL AND prompt_version IS NULL)
  )
);

-- Generation run: one row per LLM attempt, kept also when nothing is saved.
-- ref = job_offers.id for kind 'brief', ads.id for kind 'variant' (polymorphic, no FK).
CREATE TABLE IF NOT EXISTS generation_runs (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL CHECK (kind IN ('brief', 'variant')),
  ref          TEXT NOT NULL,
  attempt      INTEGER NOT NULL CHECK (attempt >= 1),
  outcome      TEXT NOT NULL CHECK (outcome IN ('ok', 'invalid', 'error')),
  issues       TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(issues) AND json_type(issues) = 'array'),
  raw_response TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS generation_runs_ref ON generation_runs (kind, ref);

-- Append-only / no physical deletes, enforced by the database.
CREATE TRIGGER IF NOT EXISTS versions_no_update BEFORE UPDATE ON versions
BEGIN SELECT RAISE(ABORT, 'versions are append-only'); END;

CREATE TRIGGER IF NOT EXISTS versions_no_delete BEFORE DELETE ON versions
BEGIN SELECT RAISE(ABORT, 'versions are append-only'); END;

CREATE TRIGGER IF NOT EXISTS variants_no_delete BEFORE DELETE ON variants
BEGIN SELECT RAISE(ABORT, 'variants are never deleted: set active = 0'); END;

CREATE TRIGGER IF NOT EXISTS ads_no_delete BEFORE DELETE ON ads
BEGIN SELECT RAISE(ABORT, 'ads are never deleted: set status = archived'); END;
