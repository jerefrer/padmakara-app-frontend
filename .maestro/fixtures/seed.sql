-- Local-only fixture for the e2e flows: one published, free event with two audio tracks
-- and one video, under fixed ids so the flows can name their rows (track-row-990001, ...).
-- Idempotent: safe to run before every e2e run. NEVER run it against production.
-- The media it points to (MinIO objects, the HLS served by cdn-server.ts) is made by
-- media.sh; without it the rows exist but nothing plays.
BEGIN;

INSERT INTO retreats (id, event_code, title_en, title_pt, status, audience_id, start_date, end_date, original_language)
VALUES (990001, 'E2E-FIXTURE', 'E2E Fixture Teaching', 'Ensinamento E2E Fixture', 'published',
        (SELECT id FROM audiences WHERE slug = 'free-anyone'), '2024-04-12', '2024-04-13', 'en')
ON CONFLICT (id) DO UPDATE SET
  event_code = EXCLUDED.event_code, title_en = EXCLUDED.title_en, title_pt = EXCLUDED.title_pt,
  status = EXCLUDED.status, audience_id = EXCLUDED.audience_id, start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date, original_language = EXCLUDED.original_language;

INSERT INTO sessions (id, retreat_id, title_en, title_pt, session_date, time_period, session_number)
VALUES (990001, 990001, 'April 12 - Morning', '12 de abril - Manhã', '2024-04-12', 'morning', 1)
ON CONFLICT (id) DO UPDATE SET
  retreat_id = EXCLUDED.retreat_id, title_en = EXCLUDED.title_en, title_pt = EXCLUDED.title_pt,
  session_date = EXCLUDED.session_date, time_period = EXCLUDED.time_period,
  session_number = EXCLUDED.session_number;

INSERT INTO tracks (id, session_id, title, title_en, title_pt, track_number, s3_key, duration_seconds,
                    original_filename, speaker, languages, original_language)
VALUES
  (990001, 990001, 'Fixture track one', 'Fixture track one', 'Faixa fixture um', 1,
   'events/E2E-FIXTURE/001-fixture-track-one.mp3', 90,
   '001-fixture-track-one.mp3', 'E2E', '{en}', 'en'),
  (990002, 990001, 'Fixture track two', 'Fixture track two', 'Faixa fixture dois', 2,
   'events/E2E-FIXTURE/002-fixture-track-two.mp3', 90,
   '002-fixture-track-two.mp3', 'E2E', '{en}', 'en')
ON CONFLICT (id) DO UPDATE SET
  session_id = EXCLUDED.session_id, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
  title_pt = EXCLUDED.title_pt, track_number = EXCLUDED.track_number, s3_key = EXCLUDED.s3_key,
  duration_seconds = EXCLUDED.duration_seconds, original_filename = EXCLUDED.original_filename,
  speaker = EXCLUDED.speaker, languages = EXCLUDED.languages,
  original_language = EXCLUDED.original_language;

-- The "bunny" guid is the directory cdn-server.ts serves the HLS from.
INSERT INTO event_videos (id, event_id, bunny_video_id, position, title_en, title_pt, video_date, duration_seconds)
VALUES (990001, 990001, 'e2e-fixture-video', 0, 'Fixture video', 'Vídeo fixture', '2024-04-12', 90)
ON CONFLICT (id) DO UPDATE SET
  event_id = EXCLUDED.event_id, bunny_video_id = EXCLUDED.bunny_video_id, position = EXCLUDED.position,
  title_en = EXCLUDED.title_en, title_pt = EXCLUDED.title_pt, video_date = EXCLUDED.video_date,
  duration_seconds = EXCLUDED.duration_seconds;

COMMIT;
