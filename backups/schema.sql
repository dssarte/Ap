


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_assignments" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "created_date" timestamp with time zone,
    "updated_date" timestamp with time zone,
    "created_by_id" "text",
    "assigned_by" "text",
    "created_by" "text",
    "is_active" boolean,
    "is_sample" boolean,
    "store_name" "text",
    "template_id" "text",
    "template_title" "text",
    "user_email" "text",
    "user_name" "text"
);


ALTER TABLE "public"."audit_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_submissions" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "created_date" timestamp with time zone,
    "updated_date" timestamp with time zone,
    "created_by_id" "text",
    "template_id" "text",
    "template_title" "text",
    "submission_date" timestamp with time zone DEFAULT "now"(),
    "submitted_by_email" "text",
    "submitted_by_name" "text",
    "brand" "text",
    "location" "text",
    "answers" "jsonb" DEFAULT '{}'::"jsonb",
    "no_comments" "jsonb" DEFAULT '{}'::"jsonb",
    "item_photos" "jsonb" DEFAULT '{}'::"jsonb",
    "score" numeric,
    "total_items" integer,
    "yes_count" integer,
    "no_count" integer,
    "na_count" integer,
    "others" "text",
    "concerns_recommendations" "text",
    "deviations_photo_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "updates" "text",
    "updates_attachment_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "signature1_photo_url" "text",
    "signature1_name" "text",
    "signature1_position" "text",
    "signature2_photo_url" "text",
    "signature2_name" "text",
    "signature2_position" "text",
    "created_by" "text",
    "is_sample" boolean DEFAULT false
);


ALTER TABLE "public"."audit_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_templates" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "created_date" timestamp with time zone,
    "updated_date" timestamp with time zone,
    "created_by_id" "text",
    "active_ticket" boolean,
    "available_from_time" "text",
    "available_to_time" "text",
    "brand_id" "text",
    "brand_name" "text",
    "created_by" "text",
    "description" "text",
    "has_time_restriction" boolean,
    "is_active" boolean,
    "is_sample" boolean,
    "sections" "jsonb",
    "store_id" "text",
    "store_name" "text",
    "store_restrictions" "jsonb",
    "title" "text"
);


ALTER TABLE "public"."audit_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brands" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "created_date" timestamp with time zone,
    "updated_date" timestamp with time zone,
    "created_by_id" "text",
    "brand_name" "text",
    "created_by" "text",
    "is_active" boolean,
    "is_sample" boolean
);


ALTER TABLE "public"."brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."canned_responses" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "created_date" timestamp with time zone,
    "updated_date" timestamp with time zone,
    "created_by_id" "text",
    "title" "text",
    "content" "text",
    "department_id" "text",
    "department_name" "text",
    "is_active" boolean DEFAULT true,
    "created_by" "text",
    "is_sample" boolean DEFAULT false
);


ALTER TABLE "public"."canned_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "created_date" timestamp with time zone,
    "updated_date" timestamp with time zone,
    "created_by_id" "text",
    "created_by" "text",
    "department_id" "text",
    "department_name" "text",
    "description" "text",
    "is_active" boolean,
    "is_audit_only" boolean,
    "is_sample" boolean,
    "name" "text"
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checklist_configs" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "created_date" timestamp with time zone,
    "updated_date" timestamp with time zone,
    "created_by_id" "text",
    "config_key" "text",
    "created_by" "text",
    "is_sample" boolean,
    "selected_template_ids" "jsonb"
);


ALTER TABLE "public"."checklist_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "created_date" timestamp with time zone,
    "updated_date" timestamp with time zone,
    "created_by_id" "text",
    "created_by" "text",
    "description" "text",
    "is_active" boolean,
    "is_sample" boolean,
    "name" "text"
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "created_date" timestamp with time zone,
    "updated_date" timestamp with time zone,
    "created_by_id" "text",
    "created_by" "text",
    "is_read" boolean,
    "is_sample" boolean,
    "link" "text",
    "message" "text",
    "ticket_id" "text",
    "title" "text",
    "type" "text",
    "user_email" "text"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_users" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "created_date" timestamp with time zone,
    "updated_date" timestamp with time zone,
    "created_by_id" "text",
    "email" "text",
    "password" "text",
    "full_name" "text",
    "display_name" "text",
    "user_type" "text",
    "department_id" "text",
    "department_name" "text",
    "phone" "text",
    "store_name" "text",
    "assigned_stores" "jsonb" DEFAULT '[]'::"jsonb",
    "is_verified" boolean DEFAULT false,
    "created_by" "text",
    "is_sample" boolean DEFAULT false,
    "role" "text",
    "app_role" "text",
    "brand_id" "text"
);


ALTER TABLE "public"."pending_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."slas" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "created_date" timestamp with time zone,
    "updated_date" timestamp with time zone,
    "created_by_id" "text",
    "created_by" "text",
    "department_id" "text",
    "description" "text",
    "escalate_after_hours" integer,
    "escalation_email" "text",
    "is_active" boolean,
    "is_sample" boolean,
    "name" "text",
    "priority" "text",
    "resolution_time_hours" integer,
    "response_time_hours" integer
);


ALTER TABLE "public"."slas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stores" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "created_date" timestamp with time zone,
    "updated_date" timestamp with time zone,
    "created_by_id" "text",
    "brand_id" "text",
    "brand_name" "text",
    "created_by" "text",
    "is_active" boolean,
    "is_sample" boolean,
    "location" "text",
    "store_name" "text"
);


ALTER TABLE "public"."stores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_comments" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "created_date" timestamp with time zone,
    "updated_date" timestamp with time zone,
    "created_by_id" "text",
    "attachment_urls" "jsonb",
    "author_email" "text",
    "author_name" "text",
    "content" "text",
    "created_by" "text",
    "is_internal" boolean,
    "is_sample" boolean,
    "ticket_id" "text"
);


ALTER TABLE "public"."ticket_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_feedback" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "created_date" timestamp with time zone,
    "updated_date" timestamp with time zone,
    "created_by_id" "text",
    "assigned_to" "text",
    "comment" "text",
    "created_by" "text",
    "department_id" "text",
    "department_name" "text",
    "is_sample" boolean,
    "rating" integer,
    "submitter_email" "text",
    "ticket_id" "text",
    "ticket_title" "text"
);


ALTER TABLE "public"."ticket_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_rules" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "created_date" timestamp with time zone,
    "updated_date" timestamp with time zone,
    "created_by_id" "text",
    "name" "text",
    "description" "text",
    "is_active" boolean DEFAULT true,
    "order" integer DEFAULT 0,
    "conditions" "jsonb" DEFAULT '[]'::"jsonb",
    "actions" "jsonb" DEFAULT '[]'::"jsonb",
    "created_by" "text",
    "is_sample" boolean DEFAULT false
);


ALTER TABLE "public"."ticket_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "created_date" timestamp with time zone,
    "updated_date" timestamp with time zone,
    "created_by_id" "text",
    "approval_status" "text",
    "approved_at" timestamp with time zone,
    "approver_email" "text",
    "approver_name" "text",
    "assigned_to" "text",
    "attachment_url" "text",
    "category_id" "text",
    "category_name" "text",
    "created_by" "text",
    "department_id" "text",
    "department_name" "text",
    "description" "text",
    "escalated" boolean,
    "escalated_at" timestamp with time zone,
    "first_response_at" timestamp with time zone,
    "handling_department_id" "text",
    "handling_department_name" "text",
    "handling_history" "jsonb",
    "image_urls" "jsonb",
    "is_sample" boolean,
    "priority" "text",
    "rejection_reason" "text",
    "resolved_at" timestamp with time zone,
    "sla_id" "text",
    "sla_resolution_breached" boolean,
    "sla_resolution_due" timestamp with time zone,
    "sla_response_breached" boolean,
    "sla_response_due" timestamp with time zone,
    "status" "text",
    "store_name" "text",
    "submitter_email" "text",
    "submitter_name" "text",
    "title" "text",
    "audit_submission_id" "text",
    "audit_template_id" "text"
);


ALTER TABLE "public"."tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "created_date" timestamp with time zone,
    "updated_date" timestamp with time zone,
    "created_by_id" "text",
    "app_role" "text",
    "app_id" "text",
    "assigned_stores" "jsonb",
    "brand_id" "text",
    "collaborator_role" "text",
    "department_id" "text",
    "department_name" "text",
    "disabled" boolean DEFAULT false,
    "disabled_reason" "text",
    "display_name" "text",
    "email" "text",
    "email_verified" boolean,
    "force_password_reset" boolean,
    "full_name" "text",
    "is_email_verified" boolean,
    "is_service" boolean,
    "is_verified" boolean,
    "phone" "text",
    "role" "text",
    "store_name" "text",
    "user_type" "text",
    "verified" boolean
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_assignments"
    ADD CONSTRAINT "audit_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_submissions"
    ADD CONSTRAINT "audit_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_templates"
    ADD CONSTRAINT "audit_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."canned_responses"
    ADD CONSTRAINT "canned_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checklist_configs"
    ADD CONSTRAINT "checklist_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_users"
    ADD CONSTRAINT "pending_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."slas"
    ADD CONSTRAINT "slas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_comments"
    ADD CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_feedback"
    ADD CONSTRAINT "ticket_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_rules"
    ADD CONSTRAINT "ticket_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "audit_submissions_submitter_idx" ON "public"."audit_submissions" USING "btree" ("lower"("submitted_by_email"));



CREATE UNIQUE INDEX "pending_users_email_lower_unique" ON "public"."pending_users" USING "btree" ("lower"(TRIM(BOTH FROM "email"))) WHERE ("email" IS NOT NULL);



CREATE INDEX "tickets_audit_submission_idx" ON "public"."tickets" USING "btree" ("audit_submission_id");



CREATE INDEX "tickets_handling_department_idx" ON "public"."tickets" USING "btree" ("handling_department_id");



CREATE INDEX "tickets_submitter_email_idx" ON "public"."tickets" USING "btree" ("lower"("submitter_email"));



CREATE UNIQUE INDEX "users_email_lower_unique" ON "public"."users" USING "btree" ("lower"(TRIM(BOTH FROM "email"))) WHERE ("email" IS NOT NULL);



ALTER TABLE "public"."audit_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."canned_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checklist_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "local_testing_all" ON "public"."audit_assignments" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "local_testing_all" ON "public"."audit_submissions" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "local_testing_all" ON "public"."audit_templates" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "local_testing_all" ON "public"."brands" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "local_testing_all" ON "public"."canned_responses" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "local_testing_all" ON "public"."categories" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "local_testing_all" ON "public"."checklist_configs" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "local_testing_all" ON "public"."departments" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "local_testing_all" ON "public"."notifications" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "local_testing_all" ON "public"."pending_users" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "local_testing_all" ON "public"."slas" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "local_testing_all" ON "public"."stores" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "local_testing_all" ON "public"."ticket_comments" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "local_testing_all" ON "public"."ticket_feedback" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "local_testing_all" ON "public"."ticket_rules" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "local_testing_all" ON "public"."tickets" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "local_testing_all" ON "public"."users" TO "authenticated", "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pending_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."slas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."ticket_comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tickets";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";















































































































































































































GRANT ALL ON TABLE "public"."audit_assignments" TO "anon";
GRANT ALL ON TABLE "public"."audit_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."audit_submissions" TO "anon";
GRANT ALL ON TABLE "public"."audit_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."audit_templates" TO "anon";
GRANT ALL ON TABLE "public"."audit_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_templates" TO "service_role";



GRANT ALL ON TABLE "public"."brands" TO "anon";
GRANT ALL ON TABLE "public"."brands" TO "authenticated";
GRANT ALL ON TABLE "public"."brands" TO "service_role";



GRANT ALL ON TABLE "public"."canned_responses" TO "anon";
GRANT ALL ON TABLE "public"."canned_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."canned_responses" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."checklist_configs" TO "anon";
GRANT ALL ON TABLE "public"."checklist_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."checklist_configs" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."pending_users" TO "anon";
GRANT ALL ON TABLE "public"."pending_users" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_users" TO "service_role";



GRANT ALL ON TABLE "public"."slas" TO "anon";
GRANT ALL ON TABLE "public"."slas" TO "authenticated";
GRANT ALL ON TABLE "public"."slas" TO "service_role";



GRANT ALL ON TABLE "public"."stores" TO "anon";
GRANT ALL ON TABLE "public"."stores" TO "authenticated";
GRANT ALL ON TABLE "public"."stores" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_comments" TO "anon";
GRANT ALL ON TABLE "public"."ticket_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_comments" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_feedback" TO "anon";
GRANT ALL ON TABLE "public"."ticket_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_rules" TO "anon";
GRANT ALL ON TABLE "public"."ticket_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_rules" TO "service_role";



GRANT ALL ON TABLE "public"."tickets" TO "anon";
GRANT ALL ON TABLE "public"."tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."tickets" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































