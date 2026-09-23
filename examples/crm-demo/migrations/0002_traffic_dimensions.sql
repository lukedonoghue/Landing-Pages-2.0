-- Additive migration: the old daily-unique aggregate remains intact.
-- Historical rows have no source/device evidence and are never guessed.
CREATE TABLE visit_events (
  event_id TEXT PRIMARY KEY,
  reporting_day TEXT NOT NULL,
  path TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  device TEXT NOT NULL DEFAULT 'unknown' CHECK(device IN ('desktop','mobile','unknown')),
  traffic_source TEXT NOT NULL DEFAULT 'unknown' CHECK(traffic_source IN ('google','facebook','instagram','microsoft','direct','other','unknown')),
  traffic_type TEXT NOT NULL DEFAULT 'unknown' CHECK(traffic_type IN ('paid','organic','other','unknown')),
  legacy INTEGER NOT NULL DEFAULT 0 CHECK(legacy IN (0,1))
);
CREATE INDEX visit_events_reporting ON visit_events(reporting_day,path,traffic_source,traffic_type,device,visitor_hash);
INSERT INTO visit_events(event_id,reporting_day,path,visitor_hash,created_at,payload_hash,legacy)
SELECT 'legacy:' || rowid,reporting_day,path,visitor_hash,created_at,'legacy',1 FROM visits;
ALTER TABLE leads ADD COLUMN visit_event_id TEXT REFERENCES visit_events(event_id);
ALTER TABLE leads ADD COLUMN device TEXT NOT NULL DEFAULT 'unknown' CHECK(device IN ('desktop','mobile','unknown'));
ALTER TABLE leads ADD COLUMN traffic_source TEXT NOT NULL DEFAULT 'unknown' CHECK(traffic_source IN ('google','facebook','instagram','microsoft','direct','other','unknown'));
ALTER TABLE leads ADD COLUMN traffic_type TEXT NOT NULL DEFAULT 'unknown' CHECK(traffic_type IN ('paid','organic','other','unknown'));
-- Retain the original matched daily-browser conversions for historical reporting.
UPDATE leads SET visit_event_id=(SELECT event_id FROM visit_events v WHERE v.legacy=1 AND v.reporting_day=leads.reporting_day AND v.path=leads.landing_page AND v.visitor_hash=leads.visitor_hash LIMIT 1);
CREATE INDEX leads_visit_event ON leads(visit_event_id);
CREATE INDEX leads_dimensions ON leads(reporting_day,traffic_source,traffic_type,device);
-- Existing lead attribution is independent of historical visit attribution.
-- Prefer the complete latest touch, never mix an old click ID into a newer touch.
WITH touches AS (
  SELECT id,CASE WHEN json_valid(attribution) THEN COALESCE(NULLIF(json_extract(attribution,'$.latest_touch'),'{}'),json_extract(attribution,'$.first_touch'),'{}') ELSE '{}' END AS touch FROM leads
), evidence AS (
  SELECT id,
    lower(trim(COALESCE(json_extract(touch,'$.utm_source'),json_extract(touch,'$.source'),''))) AS source,
    lower(replace(replace(replace(COALESCE(json_extract(touch,'$.utm_medium'),''),'_',''),'-',''),' ','')) AS medium,
    (COALESCE(json_extract(touch,'$.gclid'),'')<>'' OR COALESCE(json_extract(touch,'$.gbraid'),'')<>'' OR COALESCE(json_extract(touch,'$.wbraid'),'')<>'') AS google_click,
    COALESCE(json_extract(touch,'$.msclkid'),'')<>'' AS microsoft_click,
    COALESCE(json_extract(touch,'$.fbclid'),'')<>'' AS meta_click
  FROM touches
)
UPDATE leads SET
  traffic_source=(SELECT CASE
    WHEN google_click THEN 'google' WHEN microsoft_click THEN 'microsoft'
    WHEN source IN ('instagram','ig') THEN 'instagram'
    WHEN meta_click OR source IN ('facebook','fb','meta','facebook ads','facebookads') THEN 'facebook'
    WHEN source IN ('google','googleads','google ads','adwords') THEN 'google'
    WHEN source IN ('microsoft','bing','microsoft ads','bingads') THEN 'microsoft'
    WHEN source IN ('direct','(direct)') THEN 'direct'
    WHEN source<>'' THEN 'other' ELSE 'unknown' END FROM evidence WHERE evidence.id=leads.id),
  traffic_type=(SELECT CASE
    WHEN google_click OR microsoft_click OR medium IN ('cpc','ppc','paid','paidsearch','paidsocial','display','cpm','cpv','retargeting','remarketing') THEN 'paid'
    WHEN medium IN ('organic','organicsearch','organicsocial','social','socialmedia','socialnetwork') THEN 'organic'
    WHEN medium<>'' THEN 'other' ELSE 'unknown' END FROM evidence WHERE evidence.id=leads.id);
