import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  real,
  index,
  varchar,
} from "drizzle-orm/pg-core";

// ── Users ──

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── User Preferences ──

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  readingLevel: varchar("reading_level", { length: 20 })
    .notNull()
    .default("original"),
  language: varchar("language", { length: 10 }).notNull().default("en"),
  fontScale: real("font_scale").notNull().default(1.0),
  highContrast: boolean("high_contrast").notNull().default(false),
  reduceMotion: boolean("reduce_motion").notNull().default(false),
  jargonLevel: varchar("jargon_level", { length: 20 })
    .notNull()
    .default("original"),
  customNeeds: jsonb("custom_needs").$type<string[]>().default([]),
});

// ── Eligibility Profiles (Sensitive — coarsened data) ──

export const eligibilityProfiles = pgTable("eligibility_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  incomeBracket: varchar("income_bracket", { length: 20 }),
  state: varchar("state", { length: 2 }),
  householdSize: integer("household_size"),
  hasDisability: boolean("has_disability"),
  veteranStatus: boolean("veteran_status"),
  ageBracket: varchar("age_bracket", { length: 20 }),
});

// ── Transformation Cache ──

export const transformationCache = pgTable(
  "transformation_cache",
  {
    id: text("id").primaryKey(),
    urlHash: text("url_hash").notNull(),
    prefHash: text("pref_hash").notNull(),
    instructions: jsonb("instructions").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_transform_cache_lookup").on(table.urlHash, table.prefHash),
  ]
);

// ── Benefits Recommendations ──

export const benefitsRecommendations = pgTable(
  "benefits_recommendations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    benefitId: text("benefit_id").notNull(),
    eligibility: varchar("eligibility", { length: 10 }).notNull(), // "likely" | "possible" | "check"
    explanation: text("explanation").notNull(),
    confidence: real("confidence").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_benefits_user").on(table.userId),
  ]
);

// ── Behavioral Events ──

export const behavioralEvents = pgTable(
  "behavioral_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    eventType: varchar("event_type", { length: 30 }).notNull(),
    context: jsonb("context").$type<Record<string, unknown>>().default({}),
    embeddingId: text("embedding_id"), // Pinecone reference
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_events_user").on(table.userId),
  ]
);

// ── Form Guidance Cache ──

export const formGuidanceCache = pgTable("form_guidance_cache", {
  id: text("id").primaryKey(),
  urlPattern: text("url_pattern").notNull().unique(),
  title: text("title").notNull(),
  fieldMap: jsonb("field_map").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
