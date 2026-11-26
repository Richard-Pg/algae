export type RiskLevel = "None" | "Low" | "Medium" | "High" | "Unknown" | string;

export interface Taxonomy {
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  species?: string;
}

export interface ToxinInfo {
  produces_toxin?: boolean | string;
  toxin_type?: string;
  risk_level?: RiskLevel;
  health_effects?: string;
  is_ai_generated?: boolean;
}

export interface EcologyInfo {
  habitat?: string;
  bloom_conditions?: string;
  temperature_range?: string;
  nutrient_preference?: string;
  water_type?: string;
  seasonal_pattern?: string;
  indicator_of?: string;
  is_ai_generated?: boolean;
}

export interface Reference {
  label?: string;
  url?: string;
  notes?: string;
}

export interface ImageCredit {
  url: string;
  thumb?: string;
  creator?: string;
  license?: string;
  source?: string;
  source_url?: string;
}

export interface DatabaseInfo {
  taxonomy?: Taxonomy;
  toxin?: ToxinInfo;
  ecology?: EcologyInfo;
  description?: string;
  morphology?: string;
  common_species?: string[];
  reference_images?: string[];
  references?: Reference[];
  image_credits?: ImageCredit[];
  source?: "curated" | "compiled" | "gbif+ai";
  is_fallback?: boolean;
  gbif_key?: number;
  gbif_name?: string;
}

export interface Candidate {
  genus?: string;
  species?: string;
  confidence: number;
  morphological_notes?: string;
  reason_for_exclusion?: string;
}

export interface Quota {
  limit: number;
  remaining: number;
  signed_in: boolean;
}

export interface Identification {
  id: string | null;
  created_at?: string | null;
  filename?: string | null;
  image_url?: string | null;
  is_owner?: boolean;
  is_shared?: boolean;
  identified: boolean;
  primary_identification?: Candidate;
  alternative_identifications?: Candidate[];
  image_quality?: string;
  image_type?: string;
  is_harmful?: boolean;
  hab_alert?: string | null;
  analysis_notes?: string;
  error_message?: string;
  suggestions?: string;
  trivia?: { discovery_history?: string; fun_fact?: string; references?: string[] };
  generated_details?: { toxin?: ToxinInfo; ecology?: EcologyInfo; description?: string; morphology?: string };
  database_info?: DatabaseInfo | null;
  ai_model?: string;
  quota?: Quota;
}

export interface IdentificationSummary {
  id: string;
  created_at: string;
  filename?: string;
  image_url?: string | null;
  identified: boolean;
  genus?: string;
  species?: string;
  confidence?: number;
  is_harmful: boolean;
  risk_level?: string;
  is_shared: boolean;
}

export type SubmissionStatus = "pending" | "needs_revision" | "approved" | "rejected";

export interface Submission {
  id: string;
  created_at: string;
  updated_at?: string;
  user_name?: string;
  user_email?: string;
  proposed_genus: string;
  proposed_species?: string | null;
  location_found?: string | null;
  user_notes?: string | null;
  submitted_taxonomy?: Record<string, string> | null;
  submitted_toxin?: Record<string, string> | null;
  submitted_ecology?: Record<string, string> | null;
  submitted_references?: Reference[] | null;
  submitted_morphology?: string | null;
  collection_date?: string | null;
  sample_type?: string | null;
  microscopy_method?: string | null;
  contributor_confidence?: string | null;
  image_url?: string | null;
  identification_id?: string | null;
  ai_analysis?: Identification | null;
  status: SubmissionStatus;
  admin_notes?: string | null;
  reviewed_at?: string | null;
}

export interface SpeciesSummary {
  genus: string;
  group: string;
  phylum?: string;
  family?: string;
  risk_level: string;
  produces_toxin: boolean;
  water_type?: string;
  species_count: number;
  thumbnail?: string | null;
  description: string;
  review_status?: "draft" | "reviewed";
}

export interface SpeciesGroup {
  id: string;
  label: string;
  count: number;
}

export interface SpeciesRecord extends DatabaseInfo {
  id: string;
  genus: string;
  group: string;
  updated_at?: string;
  review_status?: "draft" | "reviewed";
  contributions: {
    id: string;
    user_name?: string;
    created_at: string;
    reviewed_at?: string;
    location_found?: string;
    proposed_species?: string;
    published_image_url?: string;
  }[];
}

export interface Me {
  id: string;
  email: string;
  display_name: string;
  is_admin: boolean;
  stats: { identifications: number; harmful: number };
}
