export declare const SCHEMA_VERSION = 4;
export declare const SCHEMA_V2_SQL: string;
export declare const SCHEMA_V3_SQL: string;
export declare const MIGRATE_SCHEMA_V1_TO_V2_SQL: string;
export declare const MIGRATE_SCHEMA_V2_TO_V3_SQL = "\nALTER TABLE meetings ADD COLUMN recording_started_at_ms INTEGER\n  CHECK (\n    recording_started_at_ms IS NULL OR\n    (origin = 'recording' AND recording_started_at_ms >= created_at_ms)\n  );\nALTER TABLE meetings ADD COLUMN recording_ended_at_ms INTEGER\n  CHECK (\n    recording_ended_at_ms IS NULL OR\n    (origin = 'recording' AND recording_started_at_ms IS NOT NULL AND\n     recording_ended_at_ms >= recording_started_at_ms)\n  );\nPRAGMA user_version = 3;\n";
export declare const MIGRATE_SCHEMA_V3_TO_V4_SQL = "\nALTER TABLE meetings ADD COLUMN run_identity TEXT CHECK (length(run_identity) <= 1024);\nALTER TABLE meetings ADD COLUMN transcript_identity TEXT CHECK (length(transcript_identity) <= 1024);\nPRAGMA user_version = 4;\n";
export declare const SCHEMA_V4_SQL: string;
