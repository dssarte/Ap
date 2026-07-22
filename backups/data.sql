SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict yAJbokwqZgdU5l7gsS0RV6Fm4QvZO9sKl6B3StJyX9pZeHlwcogQIZe5truLSJx

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."audit_log_entries" ("instance_id", "id", "payload", "created_at", "ip_address") FROM stdin;
\.


--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."custom_oauth_providers" ("id", "provider_type", "identifier", "name", "client_id", "client_secret", "acceptable_client_ids", "scopes", "pkce_enabled", "attribute_mapping", "authorization_params", "enabled", "email_optional", "issuer", "discovery_url", "skip_nonce_check", "cached_discovery", "discovery_cached_at", "authorization_url", "token_url", "userinfo_url", "jwks_uri", "created_at", "updated_at", "custom_claims_allowlist") FROM stdin;
\.


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."flow_state" ("id", "user_id", "auth_code", "code_challenge_method", "code_challenge", "provider_type", "provider_access_token", "provider_refresh_token", "created_at", "updated_at", "authentication_method", "auth_code_issued_at", "invite_token", "referrer", "oauth_client_state_id", "linking_target_id", "email_optional") FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") FROM stdin;
00000000-0000-0000-0000-000000000000	116b6e5d-5d86-47fd-81cc-8330a3fbeac5	authenticated	authenticated	lenard@figaro.ph	$2a$10$PzvaG8y027d30LXF0HL8Se2i5jHTAGwngP.pO2s6Ug0t0xAr7Mjce	2026-07-15 13:54:08.508506+00	\N		\N		\N			\N	2026-07-15 13:54:25.840327+00	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-07-15 13:54:08.481262+00	2026-07-15 13:54:25.848244+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	1ac8122a-0912-49bb-b7a8-fbd2d6809a07	authenticated	authenticated	marco@figaro.ph	$2a$10$ej64KDPMOpixdQ1HUmwTVeu0KhDV2mwneqmiEF7PPi6a/DcZPyyoa	2026-07-14 05:35:14.579677+00	\N		\N		\N			\N	2026-07-15 12:53:03.718037+00	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-07-14 05:35:14.555241+00	2026-07-15 14:57:11.279038+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	b31f1731-7283-4c8e-8b36-4c2659aa558f	authenticated	authenticated	annamariesarte28@gmail.com	$2a$10$uXejaodvxPIRPc61Xjae5O.iDOAIZ1xDOozMnl8VlLIBmQQBY5ubS	2026-07-13 08:13:43.699005+00	\N		\N		\N			\N	2026-07-16 11:55:44.866356+00	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-07-13 08:13:43.678621+00	2026-07-20 06:59:57.326858+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	c9e391a0-0aea-4fad-8880-252394042e10	authenticated	authenticated	ramonmvaldez0205@gmail.com	$2a$10$uZPzoKx63Ej2YinTWLJ1fexVYP5bzNx6BmcTDiTbuohDOzody9Lpy	2026-07-14 06:20:55.163152+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-07-14 06:20:55.151005+00	2026-07-14 06:20:55.164326+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	be885895-d8c2-420f-84c4-461e92acf9e8	authenticated	authenticated	dennis@figaro.ph	$2a$10$c2UI9Y/NdOspYr1BeoYrIurougyaLU4lUNHOgGqjkOf7wRcVnIFCO	2026-07-17 08:39:10.262554+00	\N		2026-07-17 08:38:54.626317+00		\N			\N	2026-07-17 08:39:10.268969+00	{"provider": "email", "providers": ["email"]}	{"sub": "be885895-d8c2-420f-84c4-461e92acf9e8", "email": "dennis@figaro.ph", "full_name": "Dennis Sarte", "email_verified": true, "phone_verified": false}	\N	2026-07-17 08:38:54.584357+00	2026-07-21 23:43:54.188859+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	a6928d42-9d5a-4047-951e-e9559eae0b0d	authenticated	authenticated	dennissarte@gmail.com	$2a$10$jQkXgIEGDnTUw3UCJSs6uuzOR/Jj0rgqUoZANye1caG6yL.EUiGw.	2026-07-13 07:50:49.588112+00	\N		\N		\N			\N	2026-07-20 08:16:54.009308+00	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-07-13 07:50:49.552647+00	2026-07-21 23:43:54.188512+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	01ca21db-7ac2-47b9-8d95-36ea89423ab3	authenticated	authenticated	albertlazarte151989@gmail.com	$2a$10$YLEI0MwncoMQlacmpCpDbOB8sWzoFeslilbcFs/0hEA7J3EO1VQdm	2026-07-14 06:59:44.654261+00	\N		2026-07-14 06:59:25.33437+00		\N			\N	2026-07-14 07:00:35.01598+00	{"provider": "email", "providers": ["email"]}	{"sub": "01ca21db-7ac2-47b9-8d95-36ea89423ab3", "email": "albertlazarte151989@gmail.com", "full_name": "Albert Lazarte", "email_verified": true, "phone_verified": false}	\N	2026-07-14 06:59:25.275069+00	2026-07-14 07:00:35.026814+00	\N	\N			\N		0	\N		\N	f	\N	f
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") FROM stdin;
a6928d42-9d5a-4047-951e-e9559eae0b0d	a6928d42-9d5a-4047-951e-e9559eae0b0d	{"sub": "a6928d42-9d5a-4047-951e-e9559eae0b0d", "email": "dennissarte@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-07-13 07:50:49.576997+00	2026-07-13 07:50:49.577078+00	2026-07-13 07:50:49.577078+00	dfcb7214-ef2c-4d1e-b3e3-0fc5f49ea66b
b31f1731-7283-4c8e-8b36-4c2659aa558f	b31f1731-7283-4c8e-8b36-4c2659aa558f	{"sub": "b31f1731-7283-4c8e-8b36-4c2659aa558f", "email": "annamariesarte28@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-07-13 08:13:43.692915+00	2026-07-13 08:13:43.693056+00	2026-07-13 08:13:43.693056+00	8966e102-74e2-4b87-986d-16d3093a0d6a
1ac8122a-0912-49bb-b7a8-fbd2d6809a07	1ac8122a-0912-49bb-b7a8-fbd2d6809a07	{"sub": "1ac8122a-0912-49bb-b7a8-fbd2d6809a07", "email": "marco@figaro.ph", "email_verified": false, "phone_verified": false}	email	2026-07-14 05:35:14.571739+00	2026-07-14 05:35:14.571861+00	2026-07-14 05:35:14.571861+00	0d6035fe-7b5d-421f-ae4f-e4828c68472b
c9e391a0-0aea-4fad-8880-252394042e10	c9e391a0-0aea-4fad-8880-252394042e10	{"sub": "c9e391a0-0aea-4fad-8880-252394042e10", "email": "ramonmvaldez0205@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-07-14 06:20:55.157296+00	2026-07-14 06:20:55.157349+00	2026-07-14 06:20:55.157349+00	302acd15-7c93-437c-8acd-c0ce74d76915
01ca21db-7ac2-47b9-8d95-36ea89423ab3	01ca21db-7ac2-47b9-8d95-36ea89423ab3	{"sub": "01ca21db-7ac2-47b9-8d95-36ea89423ab3", "email": "albertlazarte151989@gmail.com", "full_name": "Albert Lazarte", "email_verified": true, "phone_verified": false}	email	2026-07-14 06:59:25.31885+00	2026-07-14 06:59:25.318919+00	2026-07-14 06:59:25.318919+00	31b6a28a-cf4b-4379-b469-67c57fa77a32
116b6e5d-5d86-47fd-81cc-8330a3fbeac5	116b6e5d-5d86-47fd-81cc-8330a3fbeac5	{"sub": "116b6e5d-5d86-47fd-81cc-8330a3fbeac5", "email": "lenard@figaro.ph", "email_verified": false, "phone_verified": false}	email	2026-07-15 13:54:08.502167+00	2026-07-15 13:54:08.502241+00	2026-07-15 13:54:08.502241+00	e5671943-039d-49d6-847d-6704a7edd71d
be885895-d8c2-420f-84c4-461e92acf9e8	be885895-d8c2-420f-84c4-461e92acf9e8	{"sub": "be885895-d8c2-420f-84c4-461e92acf9e8", "email": "dennis@figaro.ph", "full_name": "Dennis Sarte", "email_verified": true, "phone_verified": false}	email	2026-07-17 08:38:54.616251+00	2026-07-17 08:38:54.616324+00	2026-07-17 08:38:54.616324+00	7656ee17-2c32-40fe-a186-3dcfce60b360
\.


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."instances" ("id", "uuid", "raw_base_config", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_clients" ("id", "client_secret_hash", "registration_type", "redirect_uris", "grant_types", "client_name", "client_uri", "logo_uri", "created_at", "updated_at", "deleted_at", "client_type", "token_endpoint_auth_method") FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") FROM stdin;
d87b8ef3-2372-4d8d-b2e8-163f46179b4c	a6928d42-9d5a-4047-951e-e9559eae0b0d	2026-07-17 01:49:11.571897+00	2026-07-21 23:43:54.204536+00	\N	aal1	\N	2026-07-21 23:43:54.203799	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	120.28.86.161	\N	\N	\N	\N	\N
9822a75e-d16f-4249-b331-2c7071d5244b	be885895-d8c2-420f-84c4-461e92acf9e8	2026-07-17 08:39:10.270521+00	2026-07-21 23:43:54.203937+00	\N	aal1	\N	2026-07-21 23:43:54.203813	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	120.28.86.161	\N	\N	\N	\N	\N
1ff0eb14-5377-40d9-9df2-bc106fc9296a	a6928d42-9d5a-4047-951e-e9559eae0b0d	2026-07-17 02:02:56.637319+00	2026-07-17 07:47:53.185246+00	\N	aal1	\N	2026-07-17 07:47:53.185126	Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	120.28.86.161	\N	\N	\N	\N	\N
cb66ef1f-effd-4ab0-a57f-03e5cc0ab3f3	a6928d42-9d5a-4047-951e-e9559eae0b0d	2026-07-17 06:36:07.061178+00	2026-07-17 08:33:05.252658+00	\N	aal1	\N	2026-07-17 08:33:05.252501	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	136.239.213.90	\N	\N	\N	\N	\N
0278643d-c053-4bdd-9ddd-447193c46922	a6928d42-9d5a-4047-951e-e9559eae0b0d	2026-07-20 08:16:54.010047+00	2026-07-20 23:51:12.893324+00	\N	aal1	\N	2026-07-20 23:51:12.893203	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	120.28.86.161	\N	\N	\N	\N	\N
831c975b-97e7-448f-a2bb-f81f21ede528	a6928d42-9d5a-4047-951e-e9559eae0b0d	2026-07-20 07:00:13.710548+00	2026-07-21 06:44:18.940088+00	\N	aal1	\N	2026-07-21 06:44:18.9399	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	120.28.86.161	\N	\N	\N	\N	\N
6239f35a-d9ea-4fb4-9d52-65bb587bcb21	a6928d42-9d5a-4047-951e-e9559eae0b0d	2026-07-17 01:49:32.248587+00	2026-07-17 01:49:32.248587+00	\N	aal1	\N	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	120.28.86.161	\N	\N	\N	\N	\N
\.


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") FROM stdin;
d87b8ef3-2372-4d8d-b2e8-163f46179b4c	2026-07-17 01:49:11.623735+00	2026-07-17 01:49:11.623735+00	password	5944f8ce-c817-48cd-9003-903f37b1a263
6239f35a-d9ea-4fb4-9d52-65bb587bcb21	2026-07-17 01:49:32.255461+00	2026-07-17 01:49:32.255461+00	password	a6daffe7-5efb-4494-9736-89ca26fc192c
1ff0eb14-5377-40d9-9df2-bc106fc9296a	2026-07-17 02:02:56.741749+00	2026-07-17 02:02:56.741749+00	password	0fe92ca6-38b4-4a3d-b5b5-038ef33e1690
cb66ef1f-effd-4ab0-a57f-03e5cc0ab3f3	2026-07-17 06:36:07.114375+00	2026-07-17 06:36:07.114375+00	password	00326049-7835-40c3-aef8-c46220ea11f3
9822a75e-d16f-4249-b331-2c7071d5244b	2026-07-17 08:39:10.286476+00	2026-07-17 08:39:10.286476+00	otp	5c4f5c35-9de2-46a9-8a40-86cf0a4be1ee
831c975b-97e7-448f-a2bb-f81f21ede528	2026-07-20 07:00:13.730341+00	2026-07-20 07:00:13.730341+00	password	4bfd8b1a-f3cc-4ab8-b4a1-78893b6ba60c
0278643d-c053-4bdd-9ddd-447193c46922	2026-07-20 08:16:54.07229+00	2026-07-20 08:16:54.07229+00	password	e3f286d7-a38f-4190-bd30-ece8a8fbfced
\.


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_factors" ("id", "user_id", "friendly_name", "factor_type", "status", "created_at", "updated_at", "secret", "phone", "last_challenged_at", "web_authn_credential", "web_authn_aaguid", "last_webauthn_challenge_data") FROM stdin;
\.


--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_challenges" ("id", "factor_id", "created_at", "verified_at", "ip_address", "otp_code", "web_authn_session_data") FROM stdin;
\.


--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_authorizations" ("id", "authorization_id", "client_id", "user_id", "redirect_uri", "scope", "state", "resource", "code_challenge", "code_challenge_method", "response_type", "status", "authorization_code", "created_at", "expires_at", "approved_at", "nonce") FROM stdin;
\.


--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_client_states" ("id", "provider_type", "code_verifier", "created_at") FROM stdin;
\.


--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_consents" ("id", "user_id", "client_id", "scopes", "granted_at", "revoked_at") FROM stdin;
\.


--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."one_time_tokens" ("id", "user_id", "token_type", "token_hash", "relates_to", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") FROM stdin;
00000000-0000-0000-0000-000000000000	76	ppyqb57yj2rj	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-17 03:10:58.067371+00	2026-07-17 05:51:34.362447+00	gqlt46nhz4v4	1ff0eb14-5377-40d9-9df2-bc106fc9296a
00000000-0000-0000-0000-000000000000	77	vevf7jdz5h6f	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-17 03:10:58.067367+00	2026-07-17 05:51:34.567566+00	t3veyhmc2sa6	d87b8ef3-2372-4d8d-b2e8-163f46179b4c
00000000-0000-0000-0000-000000000000	81	vwwuriedrmt6	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-17 05:51:34.375223+00	2026-07-17 06:49:36.965832+00	ppyqb57yj2rj	1ff0eb14-5377-40d9-9df2-bc106fc9296a
00000000-0000-0000-0000-000000000000	84	37ontw26kvk3	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-17 06:36:07.085978+00	2026-07-17 07:34:35.118218+00	\N	cb66ef1f-effd-4ab0-a57f-03e5cc0ab3f3
00000000-0000-0000-0000-000000000000	85	f3mrfqzxlfjz	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-17 06:49:36.977393+00	2026-07-17 07:47:53.158774+00	vwwuriedrmt6	1ff0eb14-5377-40d9-9df2-bc106fc9296a
00000000-0000-0000-0000-000000000000	87	rhe5b5bthyay	a6928d42-9d5a-4047-951e-e9559eae0b0d	f	2026-07-17 07:47:53.166227+00	2026-07-17 07:47:53.166227+00	f3mrfqzxlfjz	1ff0eb14-5377-40d9-9df2-bc106fc9296a
00000000-0000-0000-0000-000000000000	86	37pmxkjrr2wx	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-17 07:34:35.132241+00	2026-07-17 08:33:05.203289+00	37ontw26kvk3	cb66ef1f-effd-4ab0-a57f-03e5cc0ab3f3
00000000-0000-0000-0000-000000000000	88	me77nirj6gis	a6928d42-9d5a-4047-951e-e9559eae0b0d	f	2026-07-17 08:33:05.225902+00	2026-07-17 08:33:05.225902+00	37pmxkjrr2wx	cb66ef1f-effd-4ab0-a57f-03e5cc0ab3f3
00000000-0000-0000-0000-000000000000	82	2js6i6dmtivw	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-17 05:51:34.568101+00	2026-07-17 08:37:48.06382+00	vevf7jdz5h6f	d87b8ef3-2372-4d8d-b2e8-163f46179b4c
00000000-0000-0000-0000-000000000000	90	w6txpwvapdvp	be885895-d8c2-420f-84c4-461e92acf9e8	t	2026-07-17 08:39:10.282937+00	2026-07-20 00:15:22.367234+00	\N	9822a75e-d16f-4249-b331-2c7071d5244b
00000000-0000-0000-0000-000000000000	89	wifrcug34p3f	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-17 08:37:48.06704+00	2026-07-20 00:15:26.235079+00	2js6i6dmtivw	d87b8ef3-2372-4d8d-b2e8-163f46179b4c
00000000-0000-0000-0000-000000000000	93	cq3ugpdqldw7	be885895-d8c2-420f-84c4-461e92acf9e8	t	2026-07-20 00:15:22.369135+00	2026-07-20 03:16:22.437718+00	w6txpwvapdvp	9822a75e-d16f-4249-b331-2c7071d5244b
00000000-0000-0000-0000-000000000000	94	ncu7kv2iqjyc	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-20 00:15:26.235742+00	2026-07-20 03:16:23.009366+00	wifrcug34p3f	d87b8ef3-2372-4d8d-b2e8-163f46179b4c
00000000-0000-0000-0000-000000000000	98	ne54dy27nyoe	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-20 07:00:13.722103+00	2026-07-20 08:18:12.15239+00	\N	831c975b-97e7-448f-a2bb-f81f21ede528
00000000-0000-0000-0000-000000000000	95	g7i2h3rnkp5l	be885895-d8c2-420f-84c4-461e92acf9e8	t	2026-07-20 03:16:22.464036+00	2026-07-20 09:07:05.081245+00	cq3ugpdqldw7	9822a75e-d16f-4249-b331-2c7071d5244b
00000000-0000-0000-0000-000000000000	96	itcolmmieaj7	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-20 03:16:23.010019+00	2026-07-20 09:07:05.081289+00	ncu7kv2iqjyc	d87b8ef3-2372-4d8d-b2e8-163f46179b4c
00000000-0000-0000-0000-000000000000	73	nb7ukthyj2au	a6928d42-9d5a-4047-951e-e9559eae0b0d	f	2026-07-17 01:49:32.250234+00	2026-07-17 01:49:32.250234+00	\N	6239f35a-d9ea-4fb4-9d52-65bb587bcb21
00000000-0000-0000-0000-000000000000	101	vjrgqcab54kz	be885895-d8c2-420f-84c4-461e92acf9e8	t	2026-07-20 09:07:05.090251+00	2026-07-20 23:39:03.290629+00	g7i2h3rnkp5l	9822a75e-d16f-4249-b331-2c7071d5244b
00000000-0000-0000-0000-000000000000	102	vr3gmylroxnv	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-20 09:07:05.090191+00	2026-07-20 23:39:03.291036+00	itcolmmieaj7	d87b8ef3-2372-4d8d-b2e8-163f46179b4c
00000000-0000-0000-0000-000000000000	74	gqlt46nhz4v4	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-17 02:02:56.687387+00	2026-07-17 03:10:58.043073+00	\N	1ff0eb14-5377-40d9-9df2-bc106fc9296a
00000000-0000-0000-0000-000000000000	72	t3veyhmc2sa6	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-17 01:49:11.586715+00	2026-07-17 03:10:58.043807+00	\N	d87b8ef3-2372-4d8d-b2e8-163f46179b4c
00000000-0000-0000-0000-000000000000	99	qkjhi4z4elf7	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-20 08:16:54.041741+00	2026-07-20 23:51:12.844206+00	\N	0278643d-c053-4bdd-9ddd-447193c46922
00000000-0000-0000-0000-000000000000	105	gzlxp7mwra3l	a6928d42-9d5a-4047-951e-e9559eae0b0d	f	2026-07-20 23:51:12.863195+00	2026-07-20 23:51:12.863195+00	qkjhi4z4elf7	0278643d-c053-4bdd-9ddd-447193c46922
00000000-0000-0000-0000-000000000000	100	jv73gerux46b	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-20 08:18:12.157925+00	2026-07-21 00:39:20.130348+00	ne54dy27nyoe	831c975b-97e7-448f-a2bb-f81f21ede528
00000000-0000-0000-0000-000000000000	106	s2e4qad33ps7	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-21 00:39:20.139902+00	2026-07-21 02:14:31.382434+00	jv73gerux46b	831c975b-97e7-448f-a2bb-f81f21ede528
00000000-0000-0000-0000-000000000000	107	43f3wi2fpqjh	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-21 02:14:31.405092+00	2026-07-21 05:31:36.700565+00	s2e4qad33ps7	831c975b-97e7-448f-a2bb-f81f21ede528
00000000-0000-0000-0000-000000000000	108	jevvfoaooww3	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-21 05:31:36.7214+00	2026-07-21 06:44:18.891354+00	43f3wi2fpqjh	831c975b-97e7-448f-a2bb-f81f21ede528
00000000-0000-0000-0000-000000000000	109	mup3tjgyldqa	a6928d42-9d5a-4047-951e-e9559eae0b0d	f	2026-07-21 06:44:18.909879+00	2026-07-21 06:44:18.909879+00	jevvfoaooww3	831c975b-97e7-448f-a2bb-f81f21ede528
00000000-0000-0000-0000-000000000000	104	junbt4q2omv5	be885895-d8c2-420f-84c4-461e92acf9e8	t	2026-07-20 23:39:03.32042+00	2026-07-21 09:12:22.326233+00	vjrgqcab54kz	9822a75e-d16f-4249-b331-2c7071d5244b
00000000-0000-0000-0000-000000000000	103	6u75mj3zzeru	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-20 23:39:03.320048+00	2026-07-21 09:12:22.326018+00	vr3gmylroxnv	d87b8ef3-2372-4d8d-b2e8-163f46179b4c
00000000-0000-0000-0000-000000000000	110	4hh5oy3boayg	be885895-d8c2-420f-84c4-461e92acf9e8	t	2026-07-21 09:12:22.353731+00	2026-07-21 23:43:54.146931+00	junbt4q2omv5	9822a75e-d16f-4249-b331-2c7071d5244b
00000000-0000-0000-0000-000000000000	111	adsauonycesz	a6928d42-9d5a-4047-951e-e9559eae0b0d	t	2026-07-21 09:12:22.354265+00	2026-07-21 23:43:54.146568+00	6u75mj3zzeru	d87b8ef3-2372-4d8d-b2e8-163f46179b4c
00000000-0000-0000-0000-000000000000	113	urrsbz67ds4t	a6928d42-9d5a-4047-951e-e9559eae0b0d	f	2026-07-21 23:43:54.174732+00	2026-07-21 23:43:54.174732+00	adsauonycesz	d87b8ef3-2372-4d8d-b2e8-163f46179b4c
00000000-0000-0000-0000-000000000000	112	fhbthx7gbkrj	be885895-d8c2-420f-84c4-461e92acf9e8	f	2026-07-21 23:43:54.174732+00	2026-07-21 23:43:54.174732+00	4hh5oy3boayg	9822a75e-d16f-4249-b331-2c7071d5244b
\.


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sso_providers" ("id", "resource_id", "created_at", "updated_at", "disabled") FROM stdin;
\.


--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."saml_providers" ("id", "sso_provider_id", "entity_id", "metadata_xml", "metadata_url", "attribute_mapping", "created_at", "updated_at", "name_id_format") FROM stdin;
\.


--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."saml_relay_states" ("id", "sso_provider_id", "request_id", "for_email", "redirect_to", "created_at", "updated_at", "flow_state_id") FROM stdin;
\.


--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sso_domains" ("id", "sso_provider_id", "domain", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."webauthn_challenges" ("id", "user_id", "challenge_type", "session_data", "created_at", "expires_at") FROM stdin;
\.


--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."webauthn_credentials" ("id", "user_id", "credential_id", "public_key", "attestation_type", "aaguid", "sign_count", "transports", "backup_eligible", "backed_up", "friendly_name", "created_at", "updated_at", "last_used_at") FROM stdin;
\.


--
-- Data for Name: audit_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."audit_assignments" ("id", "created_date", "updated_date", "created_by_id", "assigned_by", "created_by", "is_active", "is_sample", "store_name", "template_id", "template_title", "user_email", "user_name") FROM stdin;
6a42054c1e75af89e4d44087	2026-06-29 05:40:28.874+00	2026-06-29 05:40:28.874+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	dennissarte@gmail.com	t	f	Mayon	6a4203e848375cd86ae437df	Store Checklist	contact@figaro.ph	contact
\.


--
-- Data for Name: audit_submissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."audit_submissions" ("id", "created_date", "updated_date", "created_by_id", "template_id", "template_title", "submission_date", "submitted_by_email", "submitted_by_name", "brand", "location", "answers", "no_comments", "item_photos", "score", "total_items", "yes_count", "no_count", "na_count", "others", "concerns_recommendations", "deviations_photo_urls", "updates", "updates_attachment_urls", "signature1_photo_url", "signature1_name", "signature1_position", "signature2_photo_url", "signature2_name", "signature2_position", "created_by", "is_sample") FROM stdin;
\.


--
-- Data for Name: audit_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."audit_templates" ("id", "created_date", "updated_date", "created_by_id", "active_ticket", "available_from_time", "available_to_time", "brand_id", "brand_name", "created_by", "description", "has_time_restriction", "is_active", "is_sample", "sections", "store_id", "store_name", "store_restrictions", "title") FROM stdin;
6a44cebe86457e4db4dba2b0	2026-07-01 08:24:30.769+00	2026-07-06 13:48:15.338+00	service_dcaa77da-20bc-404c-878f-2847d8d184f2	\N			6a3b2c03ca622cf6e4cc3290	Angels Pizza	service+dcaa77da-20bc-404c-878f-2847d8d184f2@no-reply.base44.com	Operations & Devices (OD) checklist	f	t	f	[{"id": "sec_0_srdaj", "items": [{"id": "item_0_w8g9q", "label": "PIZZA OVEN", "photo_required": true}, {"id": "item_1_59zdb", "label": "FRYER", "photo_required": true}, {"id": "item_2_n9un6", "label": "BURNER", "photo_required": true}, {"id": "item_3_cssmj", "label": "CHICKEN/PIZZA WARMER", "photo_required": true}, {"id": "item_4_cj782", "label": "MICROWAVE OVEN", "photo_required": true}, {"id": "item_5_257h9", "label": "BAINE MARIE", "photo_required": true}, {"id": "item_6_65xl3", "label": "DOUGH ROLLER", "photo_required": true}, {"id": "item_7_53ppc", "label": "DOUGH PRESSER", "photo_required": true}, {"id": "item_8_qov9o", "label": "DOUGH MIXER", "photo_required": true}, {"id": "item_9_opos4", "label": "CHEESE GRATER", "photo_required": true}, {"id": "item_10_f4pv4", "label": "ICE CRUSHER", "photo_required": true}, {"id": "item_11_ng18t", "label": "ACU", "photo_required": true}, {"id": "item_12_tgmb5", "label": "BEVERAGE CHILLER", "photo_required": true}, {"id": "item_13_5vn01", "label": "CHEST FREEZER", "photo_required": true}, {"id": "item_14_0hs36", "label": "2 DOOR CHILLER/FREEZER", "photo_required": true}, {"id": "item_15_h0ihl", "label": "4 DOOR CHILLER/FREEZER", "photo_required": true}, {"id": "item_16_tj474", "label": "WALK IN CHILLER", "photo_required": true}, {"id": "item_17_6kjjo", "label": "ELECTRICAL AND LIGHTS", "photo_required": true}, {"id": "item_18_2mast", "label": "EXHAUST & FRESH AIR", "photo_required": true}, {"id": "item_19_4v7v5", "label": "AIR CURTAIN", "photo_required": true}, {"id": "item_20_aos4q", "label": "REMARKS", "photo_required": true}], "title": "BMD"}, {"id": "sec_1_63i0w", "items": [{"id": "item_0_1u2p2", "label": "POS", "photo_required": true}, {"id": "item_1_8axte", "label": "POS PRINTER", "photo_required": true}, {"id": "item_2_qpz3m", "label": "CCTV", "photo_required": true}, {"id": "item_3_rnkom", "label": "LAPTOP", "photo_required": true}, {"id": "item_4_5uddy", "label": "PC", "photo_required": true}, {"id": "item_5_uur22", "label": "REMARKS", "photo_required": true}], "title": "MIS"}, {"id": "sec_2_9uahf", "items": [{"id": "item_0_d6y9s", "label": "MARKETING COLLATERALS", "photo_required": true}], "title": "MARKETING"}, {"id": "sec_3_luc6b", "items": [{"id": "item_0_awq9r", "label": "SIGNAGE", "photo_required": true}, {"id": "item_1_s13sg", "label": "REMARKS", "photo_required": true}], "title": "MARKETING/PURCHASING"}, {"id": "sec_4_vocq6", "items": [{"id": "item_0_fhpyo", "label": "OTHERS", "photo_required": true}], "title": "OTHERS"}]	6a3b2dc94a1650ec8b98be59	Bel Air	[{"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a3b2dc94a1650ec8b98be59", "brand_name": "Angels Pizza", "store_name": "Bel Air"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a3b2dba267128116f59fd03", "brand_name": "Angels Pizza", "store_name": "Mayon"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f6ac72b7c6880ab233c", "brand_name": "Angels Pizza", "store_name": "AP Agoo"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3ed92a408be5c891263f", "brand_name": "Angels Pizza", "store_name": "AP Aurora"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f0eeba30f0e566402d8", "brand_name": "Angels Pizza", "store_name": "AP Baguio"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f4337790be82d167e83", "brand_name": "Angels Pizza", "store_name": "AP Cauayan"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f01c72b7c6880ab2310", "brand_name": "Angels Pizza", "store_name": "AP La Union"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f254a1e78741dfeefa0", "brand_name": "Angels Pizza", "store_name": "AP Laoag"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3ec89b0de7253c253564", "brand_name": "Angels Pizza", "store_name": "AP Malate"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3eb4291cd56be1395d73", "brand_name": "Angels Pizza", "store_name": "AP Retiro"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3e6c6b60f051e41c4a12", "brand_name": "Angels Pizza", "store_name": "AP SILANG"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f57c8ca987561536697", "brand_name": "Angels Pizza", "store_name": "AP TUGUEGARAO"}]	OD CHECKLIST
6a44cebec6be6fd91966308d	2026-07-01 08:24:30.275+00	2026-07-06 13:48:49.981+00	service_dcaa77da-20bc-404c-878f-2847d8d184f2	\N	13:00	19:00	6a3b2c03ca622cf6e4cc3290	Angels Pizza	service+dcaa77da-20bc-404c-878f-2847d8d184f2@no-reply.base44.com	Mid-shift store audit checklist	t	t	f	[{"id": "sec_0_uol1d", "items": [{"id": "item_0_xkxa7", "label": "What is your current sales as of mid-shift?", "photo_required": false}, {"id": "item_1_5dghs", "label": "Are you on track to hit target sales? (input percentage TOTAL SALES/TARGET SALES)", "photo_required": false}], "title": "Sales Performance"}, {"id": "sec_1_p7zo6", "items": [{"id": "item_0_ohcy5", "label": "Marketing activity executed during mid-shift", "photo_required": true}, {"id": "item_1_rrbbw", "label": "Repair/Maintenance issues noted", "photo_required": true}, {"id": "item_2_brcau", "label": "Customer feedback/issues logged", "photo_required": false}], "title": "Manager’s Daily Focus"}, {"id": "sec_2_toots", "items": [{"id": "item_0_6yn4b", "label": "Signage still properly posted", "photo_required": true}, {"id": "item_1_e8h9m", "label": "Permits visible and updated", "photo_required": true}, {"id": "item_2_4omus", "label": "Safety signs intact", "photo_required": true}, {"id": "item_3_wczam", "label": "Marketing collateral maintained", "photo_required": true}], "title": "Business Pre-Operation"}, {"id": "sec_3_w511h", "items": [{"id": "item_0_9d6wj", "label": "Dining area maintained during peak hours", "photo_required": true}, {"id": "item_1_ui6zr", "label": "Tables/Chairs in good condition", "photo_required": true}, {"id": "item_2_v2p9h", "label": "Others", "photo_required": false}], "title": "Dining Area"}, {"id": "sec_4_ok6hr", "items": [{"id": "item_0_l4owp", "label": "Counter clean", "photo_required": true}, {"id": "item_1_e3tyl", "label": "POS clean", "photo_required": true}, {"id": "item_2_hk1ms", "label": "Receipts organized", "photo_required": false}, {"id": "item_3_uxmm6", "label": "Trash cans covered", "photo_required": true}, {"id": "item_4_h1rtc", "label": "Others", "photo_required": false}], "title": "Cashier Area"}, {"id": "sec_5_qxmvd", "items": [{"id": "item_0_z4twh", "label": "Soap/tissue refilled", "photo_required": true}, {"id": "item_1_xnugq", "label": "Cleanliness maintained", "photo_required": true}, {"id": "item_2_q2nu7", "label": "Pleasant odor", "photo_required": false}, {"id": "item_3_95e3p", "label": "Trash cans covered", "photo_required": true}, {"id": "item_4_oms43", "label": "Others", "photo_required": false}], "title": "Comfort Room"}, {"id": "sec_6_xhrip", "items": [{"id": "item_0_24osc", "label": "Food prep levels sufficient for remainder of day", "photo_required": false}, {"id": "item_1_pwlio", "label": "Stainless Table is clean and organized", "photo_required": true}, {"id": "item_2_fgmm7", "label": "Exhaust hood clean", "photo_required": true}, {"id": "item_3_wawfo", "label": "Grease trap monitored", "photo_required": true}, {"id": "item_4_86y32", "label": "Chiller/Freezer condition", "photo_required": true}, {"id": "item_5_gxaax", "label": "Utensils Clean and Organized", "photo_required": false}, {"id": "item_6_9cf5r", "label": "Stocks organize, clean and properly labelled", "photo_required": true}, {"id": "item_7_luxu7", "label": "FIFO system followed", "photo_required": true}, {"id": "item_8_jc8fy", "label": "Others", "photo_required": false}], "title": "Kitchen Area"}, {"id": "sec_7_u9i0p", "items": [{"id": "item_0_liidv", "label": "Dough Level is sufficient for the remainder of the day", "photo_required": true}, {"id": "item_1_e69bo", "label": "Check all topping availability", "photo_required": true}, {"id": "item_2_l82ij", "label": "Oven Condition", "photo_required": true}, {"id": "item_3_bevc3", "label": "Utensils Clean (slicer/peel/fork/spoodle)", "photo_required": true}, {"id": "item_4_4d440", "label": "FIFO system followed", "photo_required": false}, {"id": "item_5_vesnf", "label": "Oven Gas Available and monitored", "photo_required": true}, {"id": "item_6_dhbm4", "label": "Others", "photo_required": false}], "title": "Pizza Making Area"}, {"id": "sec_8_o8vpj", "items": [{"id": "item_0_purjd", "label": "Temperature 35–38 °F", "photo_required": true}, {"id": "item_1_abh19", "label": "Dough trays checked", "photo_required": true}, {"id": "item_2_6c6wb", "label": "FIFO system followed", "photo_required": true}, {"id": "item_3_x038k", "label": "Spoilage Monitored", "photo_required": true}, {"id": "item_4_mwtbc", "label": "Others", "photo_required": true}], "title": "Walk In Chiller"}, {"id": "sec_9_mide4", "items": [{"id": "item_0_nyxzp", "label": "Proper and Complete uniform (Hairnet/Nameplate/Bull cap/Jacket)", "photo_required": true}, {"id": "item_1_5kgqg", "label": "Proper Grooming and hygiene maintained", "photo_required": false}], "title": "Uniform & Grooming"}, {"id": "sec_10_v5ozv", "items": [{"id": "item_0_zqofd", "label": "Service Cabinet Clean and Organized", "photo_required": true}, {"id": "item_1_lqpfg", "label": "Utensils warmer is clean and heating properly", "photo_required": true}, {"id": "item_2_ofaf1", "label": "Hot sauce, catsup, and other condiment containers are clean", "photo_required": true}, {"id": "item_3_y4euk", "label": "Others", "photo_required": true}], "title": "Service"}]	6a3b2dc94a1650ec8b98be59	Bel Air	[{"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a3b2dc94a1650ec8b98be59", "brand_name": "Angels Pizza", "store_name": "Bel Air"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a3b2dba267128116f59fd03", "brand_name": "Angels Pizza", "store_name": "Mayon"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f6ac72b7c6880ab233c", "brand_name": "Angels Pizza", "store_name": "AP Agoo"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3ed92a408be5c891263f", "brand_name": "Angels Pizza", "store_name": "AP Aurora"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f0eeba30f0e566402d8", "brand_name": "Angels Pizza", "store_name": "AP Baguio"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f4337790be82d167e83", "brand_name": "Angels Pizza", "store_name": "AP Cauayan"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f01c72b7c6880ab2310", "brand_name": "Angels Pizza", "store_name": "AP La Union"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f254a1e78741dfeefa0", "brand_name": "Angels Pizza", "store_name": "AP Laoag"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3ec89b0de7253c253564", "brand_name": "Angels Pizza", "store_name": "AP Malate"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3eb4291cd56be1395d73", "brand_name": "Angels Pizza", "store_name": "AP Retiro"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3e6c6b60f051e41c4a12", "brand_name": "Angels Pizza", "store_name": "AP SILANG"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f57c8ca987561536697", "brand_name": "Angels Pizza", "store_name": "AP TUGUEGARAO"}]	MID CHECKLIST
6a44cebee6878f675124509c	2026-07-01 08:24:30.084+00	2026-07-13 01:12:18.525+00	service_dcaa77da-20bc-404c-878f-2847d8d184f2	f	07:00	12:00	6a3b2c03ca622cf6e4cc3290	Angels Pizza	service+dcaa77da-20bc-404c-878f-2847d8d184f2@no-reply.base44.com	Pre-opening store audit checklist	t	t	f	[{"id": "sec_0_6mt06", "items": [{"id": "item_0_nw0iv", "label": "Target Sales for Today", "photo_required": false}], "title": "Sales Performance"}, {"id": "sec_1_vz7qu", "items": [{"id": "item_0_lg55m", "label": "Marketing Activity (AM/PM)", "photo_required": true}, {"id": "item_1_vvcun", "label": "Repair/Maintenance Plan of Action", "photo_required": true}, {"id": "item_2_zdion", "label": "Cost-saving Initiatives", "photo_required": false}, {"id": "item_3_453rj", "label": "Sales deposit from yesterday's sales", "photo_required": true}], "title": "Manager’s Daily Focus"}, {"id": "sec_2_318jg", "items": [{"id": "item_0_h5h39", "label": "Signage Properly Posted", "photo_required": true}, {"id": "item_1_1flli", "label": "Permits Available and Updated", "photo_required": true}, {"id": "item_2_0vg7g", "label": "Safety Signs Visible", "photo_required": true}, {"id": "item_3_84fiw", "label": "Marketing Collateral Clean/Updated", "photo_required": true}], "title": "Business Pre-Operation"}, {"id": "sec_3_jkxwz", "items": [{"id": "item_0_fruhz", "label": "Glass/Walls/Floors Clean", "photo_required": true}, {"id": "item_1_iyrrq", "label": "Tables/Chairs Clean and in Good Condition", "photo_required": true}, {"id": "item_2_gzghw", "label": "Utensils Wares Complete/Organized", "photo_required": true}, {"id": "item_3_2etr3", "label": "ACU/Lights Working", "photo_required": true}, {"id": "item_4_a4hcl", "label": "Others", "photo_required": true}], "title": "Dining Area"}, {"id": "sec_4_0aqlr", "items": [{"id": "item_0_7p4ok", "label": "Counter Area is Clean and Organized", "photo_required": true}, {"id": "item_1_7lauh", "label": "POS Clean", "photo_required": true}, {"id": "item_2_jndxw", "label": "Receipts Organized", "photo_required": false}, {"id": "item_3_nh5cz", "label": "Trash Cans Covered", "photo_required": true}, {"id": "item_4_s4d6l", "label": "Others", "photo_required": true}], "title": "Cashier Area"}, {"id": "sec_5_dndx2", "items": [{"id": "item_0_42qx9", "label": "Water/Soap/Tissue Available", "photo_required": true}, {"id": "item_1_xa8rf", "label": "Cleanliness (Floor/Walls/Mirror/Bowl)", "photo_required": true}, {"id": "item_2_dy8j8", "label": "Pleasant Odor", "photo_required": false}, {"id": "item_3_gwv6s", "label": "Trash Cans Covered", "photo_required": true}, {"id": "item_4_kc78z", "label": "Others", "photo_required": true}], "title": "Comfort Room"}, {"id": "sec_6_dz3p3", "items": [{"id": "item_0_e3t4e", "label": "Stainless Tables are Clean and organized", "photo_required": false}, {"id": "item_1_z557p", "label": "Exhaust Hood Clean", "photo_required": true}, {"id": "item_2_qga7e", "label": "Grease Trap Clean", "photo_required": true}, {"id": "item_3_nfefs", "label": "Chiller/Freezer Condition", "photo_required": true}, {"id": "item_4_wj7vs", "label": "Utensils Clean and Organized", "photo_required": false}, {"id": "item_5_31y9d", "label": "Stocks organized, clean and properly labelled", "photo_required": true}, {"id": "item_6_ru59w", "label": "FIFO System Followed", "photo_required": true}, {"id": "item_7_nsckn", "label": "Others", "photo_required": true}], "title": "Kitchen Area"}, {"id": "sec_7_ccwuz", "items": [{"id": "item_0_tplq3", "label": "Dough Age (3–6 days)", "photo_required": true}, {"id": "item_1_x5oz5", "label": "Check all toppings availability", "photo_required": true}, {"id": "item_2_igb26", "label": "Oven Condition", "photo_required": true}, {"id": "item_3_wg1zw", "label": "Utensils Clean (slicer/peel/fork/spoodle)", "photo_required": true}, {"id": "item_4_6dpr1", "label": "Portion Chart Organized", "photo_required": false}, {"id": "item_5_ebt6i", "label": "FIFO System Followed", "photo_required": true}, {"id": "item_6_vu0kp", "label": "Dough roller/presser in good condition", "photo_required": true}, {"id": "item_7_mgpzy", "label": "Oven Gas available and monitored", "photo_required": true}, {"id": "item_8_az7rx", "label": "Others", "photo_required": true}], "title": "Pizza Making Area"}, {"id": "sec_8_2usj7", "items": [{"id": "item_0_k9qgm", "label": "Stock Organized, clean and properly labelled", "photo_required": true}, {"id": "item_1_szuqw", "label": "Temperature 35–38 °F", "photo_required": true}, {"id": "item_2_qsb6q", "label": "FIFO System Followed", "photo_required": true}, {"id": "item_3_0qbhd", "label": "Spoilage Monitored", "photo_required": true}], "title": "Walk-in Chiller"}, {"id": "sec_9_drwgn", "items": [{"id": "item_0_g3neb", "label": "Proper And complete Uniform(Hair Net/Nameplate/Bull cap/jacket)", "photo_required": true}, {"id": "item_1_x49qk", "label": "Proper grooming and hygiene maintained", "photo_required": true}], "title": "Uniform & Grooming"}, {"id": "sec_10_p02iw", "items": [{"id": "item_0_yr8eh", "label": "Service cabinet clean and organized", "photo_required": true}, {"id": "item_1_1gk53", "label": "Utensils warmer is clean and heating properly", "photo_required": true}, {"id": "item_2_9a9sr", "label": "Hot sauce, catsup and other condiment are clean", "photo_required": true}, {"id": "item_3_bwco5", "label": "Others", "photo_required": true}], "title": "Service"}]	6a3b2dc94a1650ec8b98be59	Bel Air	[{"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a3b2dc94a1650ec8b98be59", "brand_name": "Angels Pizza", "store_name": "Bel Air"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a3b2dba267128116f59fd03", "brand_name": "Angels Pizza", "store_name": "Mayon"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f6ac72b7c6880ab233c", "brand_name": "Angels Pizza", "store_name": "AP Agoo"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3ed92a408be5c891263f", "brand_name": "Angels Pizza", "store_name": "AP Aurora"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f0eeba30f0e566402d8", "brand_name": "Angels Pizza", "store_name": "AP Baguio"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f4337790be82d167e83", "brand_name": "Angels Pizza", "store_name": "AP Cauayan"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f01c72b7c6880ab2310", "brand_name": "Angels Pizza", "store_name": "AP La Union"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f254a1e78741dfeefa0", "brand_name": "Angels Pizza", "store_name": "AP Laoag"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3ec89b0de7253c253564", "brand_name": "Angels Pizza", "store_name": "AP Malate"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3eb4291cd56be1395d73", "brand_name": "Angels Pizza", "store_name": "AP Retiro"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3e6c6b60f051e41c4a12", "brand_name": "Angels Pizza", "store_name": "AP SILANG"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f57c8ca987561536697", "brand_name": "Angels Pizza", "store_name": "AP TUGUEGARAO"}]	OPENING CHECKLIST
6a3b2e696a43f6156e855ac0	2026-06-24 01:10:01.488+00	2026-06-24 01:10:01.488+00	6979737791aaf996d5335e2a	\N	\N	\N	\N	\N	dennissarte@gmail.com	Product Quality Audit Checklist	\N	t	f	[{"id": "95rujlk", "items": [{"id": "faypfm9", "label": "Dough properly managed -All sizes are available, within the standard temperature, storage & shelf life"}, {"id": "fpbqshx", "label": "Pizza preparation is followed (Perfect 10 Pizza)"}, {"id": "ph3rp3v", "label": "Standard time and temperature is being followed"}, {"id": "wqu1nr1", "label": "Standard presentation is being followed, with complete condiments"}, {"id": "9ltu3eu", "label": "Others"}], "title": "A.1 PRODUCT QUALITY"}, {"id": "klxfo1y", "items": [{"id": "8x6d9dw", "label": "Topping so Bongga"}, {"id": "72ekk92", "label": "Cheesy Burger"}, {"id": "u581eyf", "label": "Creamy Garlic and Five Cheese"}, {"id": "8sc6bc3", "label": "Angel's Pepperoni"}, {"id": "4ucxm8k", "label": "All Meat"}, {"id": "r3wjufg", "label": "Chicken Aloha"}], "title": "A.2 PIZZA PRODUCT QUALITY"}]	\N	\N	\N	Product Quality Audit (2nd)
6a3b23631edac1c30f236ce0	2026-06-24 00:22:59.871+00	2026-06-24 00:22:59.871+00	6979737791aaf996d5335e2a	\N	\N	\N	\N	\N	dennissarte@gmail.com	Product Quality Audit Checklist	\N	t	f	[{"id": "o20wwpl", "items": [{"id": "j24trur", "label": "Dough properly managed - All sizes are available, within the standard temperature, storage & shelf life"}, {"id": "b4hoquq", "label": "Pizza preparation is followed (Perfect 10 Pizza)"}], "title": "A.1 PRODUCT QUALITY"}]	\N	\N	\N	Product Quality Audit (1st)
6a4203e848375cd86ae437df	2026-06-29 05:34:32.441+00	2026-07-15 14:40:13.542+00	6979737791aaf996d5335e2a	t			6a3b2c03ca622cf6e4cc3290	Angels Pizza	dennissarte@gmail.com	Store Daily Checklist	f	t	f	[{"id": "jbosfky", "items": [{"id": "1rub4e7", "label": "Cash", "photo_required": true}, {"id": "ylrpn0i", "label": "Visa/Master Card", "photo_required": true}, {"id": "wcuxi99", "label": "AR", "photo_required": true}], "title": "MIS"}, {"id": "252yhya", "items": [{"id": "sb7qafs", "label": "Deposit 10am", "photo_required": true}, {"id": "y7amgon", "label": "Deposit 2pm", "photo_required": true}], "title": "BMD"}]	6a3b2dc94a1650ec8b98be59	Bel Air	[{"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a3b2dc94a1650ec8b98be59", "brand_name": "Angels Pizza", "store_name": "Bel Air"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a3b2dba267128116f59fd03", "brand_name": "Angels Pizza", "store_name": "Mayon"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f6ac72b7c6880ab233c", "brand_name": "Angels Pizza", "store_name": "AP Agoo"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3ed92a408be5c891263f", "brand_name": "Angels Pizza", "store_name": "AP Aurora"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f0eeba30f0e566402d8", "brand_name": "Angels Pizza", "store_name": "AP Baguio"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f4337790be82d167e83", "brand_name": "Angels Pizza", "store_name": "AP Cauayan"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f01c72b7c6880ab2310", "brand_name": "Angels Pizza", "store_name": "AP La Union"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f254a1e78741dfeefa0", "brand_name": "Angels Pizza", "store_name": "AP Laoag"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3ec89b0de7253c253564", "brand_name": "Angels Pizza", "store_name": "AP Malate"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3eb4291cd56be1395d73", "brand_name": "Angels Pizza", "store_name": "AP Retiro"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3e6c6b60f051e41c4a12", "brand_name": "Angels Pizza", "store_name": "AP SILANG"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f57c8ca987561536697", "brand_name": "Angels Pizza", "store_name": "AP TUGUEGARAO"}, {"brand_id": "6a3b2dab75f1bfaab440b521", "store_id": "6a3b2dd822c8fad40fcecae0", "brand_name": "Figaro Coffee", "store_name": "Trinoma"}]	Store Checklist
6a44cebeccd1385697eb1072	2026-07-01 08:24:30.445+00	2026-07-15 14:42:05.31+00	service_dcaa77da-20bc-404c-878f-2847d8d184f2	f	21:00	05:00	6a3b2c03ca622cf6e4cc3290	Angels Pizza	service+dcaa77da-20bc-404c-878f-2847d8d184f2@no-reply.base44.com	Store closing audit checklist	t	t	f	[{"id": "sec_0_ctqjx", "items": [{"id": "item_0_lw300", "label": "Did you hit the target sales today?", "photo_required": false}, {"id": "item_1_qk30m", "label": "What is your total sales for today?", "photo_required": true}], "title": "Sales Performance"}, {"id": "sec_1_dc4kp", "items": [{"id": "item_0_ww053", "label": "Cash Count Reconciled (Cash Sales, Change Fund, PCF Fund)", "photo_required": true}, {"id": "item_1_b80yk", "label": "Receipts Organized and Secured", "photo_required": true}, {"id": "item_2_equhz", "label": "Void and re-opened receipts complete", "photo_required": true}, {"id": "item_3_xru14", "label": "Inventory Updated (Input All-in-FC Summary)", "photo_required": true}, {"id": "item_4_vrvax", "label": "POS has been shutdown after report consolidation", "photo_required": true}, {"id": "item_5_2mg0n", "label": "Others", "photo_required": true}], "title": "Cash & Inventory"}, {"id": "sec_2_bvkcw", "items": [{"id": "item_0_513b6", "label": "Tables/chairs cleaned and stacked", "photo_required": true}, {"id": "item_1_p3ema", "label": "Floors swept/mopped", "photo_required": true}, {"id": "item_2_ibmz0", "label": "Lights and ACU turned off", "photo_required": true}, {"id": "item_3_zkayt", "label": "Others", "photo_required": true}], "title": "Dining Area"}, {"id": "sec_3_99bro", "items": [{"id": "item_0_vj3f2", "label": "Utensils washed and stored", "photo_required": true}, {"id": "item_1_eeges", "label": "Chiller/freezer checked and closed", "photo_required": true}, {"id": "item_2_9xdzr", "label": "Grease trap cleaned", "photo_required": true}, {"id": "item_3_pvleu", "label": "FIFO stock updated", "photo_required": true}, {"id": "item_4_t19mj", "label": "Others", "photo_required": true}], "title": "Kitchen Area"}, {"id": "sec_4_87s1t", "items": [{"id": "item_0_fz85x", "label": "Dough trays stored properly", "photo_required": true}, {"id": "item_1_zt5xj", "label": "Sauce/cheese containers sealed", "photo_required": true}, {"id": "item_2_21kr9", "label": "Oven turned off and cleaned", "photo_required": true}, {"id": "item_3_c800a", "label": "Tools washed and stored", "photo_required": true}, {"id": "item_4_v9075", "label": "FIFO stock updated", "photo_required": true}, {"id": "item_5_rc496", "label": "Others", "photo_required": true}], "title": "Pizza Making Area"}, {"id": "sec_5_gn36z", "items": [{"id": "item_0_able6", "label": "Temperature checked and logged", "photo_required": true}, {"id": "item_1_cih0q", "label": "Stocks organized", "photo_required": true}, {"id": "item_2_v5v70", "label": "Spoilage disposed properly", "photo_required": true}, {"id": "item_3_kihi2", "label": "Others", "photo_required": true}], "title": "Walk-in Chiller"}, {"id": "sec_6_jqitj", "items": [{"id": "item_0_6f5xx", "label": "Floors/walls cleaned", "photo_required": true}, {"id": "item_1_a1e2m", "label": "Soap/tissue refilled", "photo_required": true}, {"id": "item_2_mwt80", "label": "Trash bins emptied", "photo_required": true}, {"id": "item_3_td4mo", "label": "Lights turned off", "photo_required": true}, {"id": "item_4_oa9ai", "label": "Others", "photo_required": true}], "title": "Comfort Room"}, {"id": "sec_7_kt1tp", "items": [{"id": "item_0_deoru", "label": "Condiments are properly stored and maintained", "photo_required": true}, {"id": "item_1_cy25r", "label": "Others", "photo_required": true}], "title": "Service"}, {"id": "sec_8_xmjmh", "items": [{"id": "item_0_4ibwz", "label": "Security guard checked in", "photo_required": true}, {"id": "item_1_ec2oa", "label": "Staff checked out", "photo_required": true}], "title": "Others"}]	6a3b2dc94a1650ec8b98be59	Bel Air	[{"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a3b2dc94a1650ec8b98be59", "brand_name": "Angels Pizza", "store_name": "Bel Air"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a3b2dba267128116f59fd03", "brand_name": "Angels Pizza", "store_name": "Mayon"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f6ac72b7c6880ab233c", "brand_name": "Angels Pizza", "store_name": "AP Agoo"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3ed92a408be5c891263f", "brand_name": "Angels Pizza", "store_name": "AP Aurora"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f0eeba30f0e566402d8", "brand_name": "Angels Pizza", "store_name": "AP Baguio"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f4337790be82d167e83", "brand_name": "Angels Pizza", "store_name": "AP Cauayan"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f01c72b7c6880ab2310", "brand_name": "Angels Pizza", "store_name": "AP La Union"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f254a1e78741dfeefa0", "brand_name": "Angels Pizza", "store_name": "AP Laoag"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3ec89b0de7253c253564", "brand_name": "Angels Pizza", "store_name": "AP Malate"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3eb4291cd56be1395d73", "brand_name": "Angels Pizza", "store_name": "AP Retiro"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3e6c6b60f051e41c4a12", "brand_name": "Angels Pizza", "store_name": "AP SILANG"}, {"brand_id": "6a3b2c03ca622cf6e4cc3290", "store_id": "6a4b3f57c8ca987561536697", "brand_name": "Angels Pizza", "store_name": "AP TUGUEGARAO"}]	CLOSING CHECKLIST
\.


--
-- Data for Name: brands; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."brands" ("id", "created_date", "updated_date", "created_by_id", "brand_name", "created_by", "is_active", "is_sample") FROM stdin;
6a3b2dab75f1bfaab440b521	2026-06-24 01:06:51.799+00	2026-06-24 01:06:51.799+00	6979737791aaf996d5335e2a	Figaro Coffee	dennissarte@gmail.com	t	f
6a3b2c03ca622cf6e4cc3290	2026-06-24 00:59:47.474+00	2026-06-24 01:06:41.099+00	6979737791aaf996d5335e2a	Angels Pizza	dennissarte@gmail.com	t	f
\.


--
-- Data for Name: canned_responses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."canned_responses" ("id", "created_date", "updated_date", "created_by_id", "title", "content", "department_id", "department_name", "is_active", "created_by", "is_sample") FROM stdin;
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."categories" ("id", "created_date", "updated_date", "created_by_id", "created_by", "department_id", "department_name", "description", "is_active", "is_audit_only", "is_sample", "name") FROM stdin;
6a4c572796ebce5b046af4aa	2026-07-07 01:32:23.203+00	2026-07-07 01:32:23.203+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	6a4c571d0099f6da12a8934b	Marketing		t	f	f	Marketing Concerns
6a4c5715c68788fbaee240f2	2026-07-07 01:32:05.422+00	2026-07-07 01:32:05.422+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	6a3b36e262dd0fe3bc2085d9	Quality Assurance		t	f	f	QA Concerns
6a4c570529735e3c367744ce	2026-07-07 01:31:49.944+00	2026-07-07 01:31:49.944+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	6a420012041f3968458e3b36	SOD		t	f	f	SOD Concerns
6a4c56ea1bd1a6077bc2003b	2026-07-07 01:31:22.02+00	2026-07-07 01:31:22.02+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	6a4c566283713ffa14785e1a	BMD		t	f	f	BMD Concerns
6a44cfc6e3a2f05b9eb0410b	2026-07-01 08:28:54.822+00	2026-07-01 08:32:53.568+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	6a420012041f3968458e3b36	SOD		t	t	f	OD CHECKLIST
6a44cfb5d13df86f4ba7a4c8	2026-07-01 08:28:37.064+00	2026-07-01 08:33:11.471+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	6a420012041f3968458e3b36	SOD		t	t	f	CLOSING CHECKLIST
6a44cfa9ca32245abf12fec1	2026-07-01 08:28:25.694+00	2026-07-01 08:33:14.872+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	6a420012041f3968458e3b36	SOD		t	t	f	MID CHECKLIST
6a44cf9b16b0008700a5f511	2026-07-01 08:28:11.893+00	2026-07-01 08:33:44.215+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	6a420012041f3968458e3b36	SOD		t	t	f	OPENING CHECKLIST
6a41ffa2b565e3b8fda62141	2026-06-29 05:16:18.669+00	2026-07-01 08:35:13.285+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	6a420012041f3968458e3b36	SOD	For Store Audit	t	t	f	Store Checklist
6a3b217c39f27071f9654ccb	2026-06-24 00:14:52.524+00	2026-06-29 05:18:30.76+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	6a3b36e262dd0fe3bc2085d9	Quality Assurance		t	t	f	Service Quality Audit
6a3b217c39f27071f9654cb9	2026-06-24 00:14:52.523+00	2026-06-24 00:35:10.522+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Follow up Audit
6a3b217c39f27071f9654cbf	2026-06-24 00:14:52.523+00	2026-06-24 00:35:55.065+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Mayon 1&2 Daily Walkthrough Housekeeping
6a3b217c39f27071f9654cc8	2026-06-24 00:14:52.523+00	2026-06-24 00:36:57.083+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Figaro Punchlist
6a3b217c39f27071f9654cbe	2026-06-24 00:14:52.523+00	2026-06-24 00:35:47.63+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Figaro Commissary
6a3b217c39f27071f9654cb8	2026-06-24 00:14:52.523+00	2026-06-24 00:35:03.443+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Angel's Pizza
6a3b217c39f27071f9654cc9	2026-06-24 00:14:52.523+00	2026-06-24 00:37:05.477+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Tien Ma's Punchlist
6a3b217c39f27071f9654cc1	2026-06-24 00:14:52.523+00	2026-06-24 00:36:06.451+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Angel's Pizza Commissary
6a3b217c39f27071f9654cc6	2026-06-24 00:14:52.523+00	2026-06-24 00:36:41.68+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Tarlac Commissary
6a3b217c39f27071f9654cca	2026-06-24 00:14:52.523+00	2026-06-24 00:37:12.603+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Angel's Pizza Punchlist
6a3b217c39f27071f9654cb7	2026-06-24 00:14:52.523+00	2026-06-24 00:32:56.881+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Product Quality Audit (2nd)
6a3b217c39f27071f9654cc7	2026-06-24 00:14:52.523+00	2026-06-24 00:36:50.392+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Tarlac Warehouse
6a3b217c39f27071f9654cb6	2026-06-24 00:14:52.523+00	2026-06-24 00:32:49.946+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Product Quality Audit (1st)
6a3b217c39f27071f9654cbb	2026-06-24 00:14:52.523+00	2026-06-24 00:35:24.469+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Tien Ma's
6a3b217c39f27071f9654cbd	2026-06-24 00:14:52.523+00	2026-06-24 00:35:39.776+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Individual 5S Audit
6a3b217c39f27071f9654cba	2026-06-24 00:14:52.523+00	2026-06-24 00:35:16.976+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Figaro Coffee
6a3b217c39f27071f9654cc3	2026-06-24 00:14:52.523+00	2026-06-24 00:36:22.648+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Tien Ma's Commissary
6a3b217c39f27071f9654cc5	2026-06-24 00:14:52.523+00	2026-06-24 00:36:35.743+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Koobideh Kebabs
6a3b217c39f27071f9654cc4	2026-06-24 00:14:52.523+00	2026-06-24 00:36:28.458+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	ISD Commissary
6a3b217c39f27071f9654cc0	2026-06-24 00:14:52.523+00	2026-06-24 00:36:00.135+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Warehouse
6a3b217c39f27071f9654cbc	2026-06-24 00:14:52.523+00	2026-06-24 00:35:34.488+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Café Portofino
6a3b217c39f27071f9654cc2	2026-06-24 00:14:52.523+00	2026-06-24 00:36:16.192+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	\N		t	t	f	Roasting Facility
69816431c4763e210b2ce6dd	2026-02-03 02:57:53.601+00	2026-06-24 05:16:48.795+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	697974464f1fb25c5716c684	Purchasing		t	f	f	PURCHASING Concerns
698162ef3dd5158f4bb2cd92	2026-02-03 02:52:31.804+00	2026-06-24 05:17:22.875+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	697974464f1fb25c5716c683	Finance		t	f	f	ACCOUNTING Concerns
698147cb088210ca8849d83c	2026-02-03 00:56:43.829+00	2026-06-24 05:17:11.862+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	697974464f1fb25c5716c681	MIS		t	f	f	MIS Concerns
6981479119956916002ad050	2026-02-03 00:55:45.337+00	2026-06-24 05:17:31.036+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	697974464f1fb25c5716c682	Human Resources		t	f	f	HRD Concerns
\.


--
-- Data for Name: checklist_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."checklist_configs" ("id", "created_date", "updated_date", "created_by_id", "config_key", "created_by", "is_sample", "selected_template_ids") FROM stdin;
6a4af7c6ac30cebb26b8c0da	2026-07-06 00:33:10.367+00	2026-07-06 00:48:09.274+00	6979737791aaf996d5335e2a	default	dennissarte@gmail.com	f	["6a44cebec6be6fd91966308d", "6a44cebee6878f675124509c", "6a44cebeccd1385697eb1072"]
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."departments" ("id", "created_date", "updated_date", "created_by_id", "created_by", "description", "is_active", "is_sample", "name") FROM stdin;
6a4c571d0099f6da12a8934b	2026-07-07 01:32:13.491+00	2026-07-07 01:32:13.491+00	6979737791aaf996d5335e2a	dennissarte@gmail.com		t	f	Marketing
6a4c566283713ffa14785e1a	2026-07-07 01:29:06.556+00	2026-07-07 01:29:06.556+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	Building and Maintenance Department	t	f	BMD
6a420012041f3968458e3b36	2026-06-29 05:18:10.017+00	2026-06-29 05:18:10.017+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	Store Operation Department	t	f	SOD
6a3b36e262dd0fe3bc2085d9	2026-06-24 01:46:10.681+00	2026-06-24 01:46:23.955+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	services meet specified requirements and customer expectations	t	f	Quality Assurance
697974464f1fb25c5716c684	2026-01-28 02:28:22.304+00	2026-02-03 02:58:15.093+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	All request	t	f	Purchasing
697974464f1fb25c5716c682	2026-01-28 02:28:22.304+00	2026-01-28 02:28:22.304+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	HR policies, benefits, and employee relations	t	f	Human Resources
697974464f1fb25c5716c681	2026-01-28 02:28:22.304+00	2026-06-24 05:15:32.775+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	Technical support and IT-related issues	t	f	MIS
697974464f1fb25c5716c683	2026-01-28 02:28:22.304+00	2026-07-07 01:30:45.381+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	Billing, payments, and financial inquiries	t	f	Accounting
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."notifications" ("id", "created_date", "updated_date", "created_by_id", "created_by", "is_read", "is_sample", "link", "message", "ticket_id", "title", "type", "user_email") FROM stdin;
\.


--
-- Data for Name: pending_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."pending_users" ("id", "created_date", "updated_date", "created_by_id", "email", "password", "full_name", "display_name", "user_type", "department_id", "department_name", "phone", "store_name", "assigned_stores", "is_verified", "created_by", "is_sample", "role", "app_role", "brand_id") FROM stdin;
\.


--
-- Data for Name: slas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."slas" ("id", "created_date", "updated_date", "created_by_id", "created_by", "department_id", "description", "escalate_after_hours", "escalation_email", "is_active", "is_sample", "name", "priority", "resolution_time_hours", "response_time_hours") FROM stdin;
698160d702817160156c598c	2026-02-03 02:43:35.107+00	2026-02-04 05:48:59.438+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	SLA for medium priority tickets	16		t	f	Medium Priority SLA	medium	24	6
698160d702817160156c598d	2026-02-03 02:43:35.107+00	2026-02-03 02:43:35.107+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	SLA for low priority tickets	36	\N	t	f	Low Priority SLA	low	48	8
698160d702817160156c598b	2026-02-03 02:43:35.106+00	2026-02-04 05:49:47.526+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	SLA for high priority tickets	6		t	f	High Priority SLA	high	8	4
698160d702817160156c598a	2026-02-03 02:43:35.106+00	2026-02-04 05:49:53.722+00	6979737791aaf996d5335e2a	dennissarte@gmail.com	\N	SLA for urgent priority tickets	6		t	f	Urgent Priority SLA	urgent	4	3
\.


--
-- Data for Name: stores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."stores" ("id", "created_date", "updated_date", "created_by_id", "brand_id", "brand_name", "created_by", "is_active", "is_sample", "location", "store_name") FROM stdin;
6a4b3f6ac72b7c6880ab233c	2026-07-06 05:38:50.826+00	2026-07-06 05:38:50.826+00	6979737791aaf996d5335e2a	6a3b2c03ca622cf6e4cc3290	Angels Pizza	dennissarte@gmail.com	t	f	Agoo La Union	AP Agoo
6a4b3f57c8ca987561536697	2026-07-06 05:38:31.631+00	2026-07-06 05:38:31.631+00	6979737791aaf996d5335e2a	6a3b2c03ca622cf6e4cc3290	Angels Pizza	dennissarte@gmail.com	t	f	TUGUEGARAO City	AP TUGUEGARAO
6a4b3f4337790be82d167e83	2026-07-06 05:38:11.974+00	2026-07-06 05:38:11.974+00	6979737791aaf996d5335e2a	6a3b2c03ca622cf6e4cc3290	Angels Pizza	dennissarte@gmail.com	t	f	CAUAYAN City	AP Cauayan
6a4b3f254a1e78741dfeefa0	2026-07-06 05:37:41.095+00	2026-07-06 05:37:41.095+00	6979737791aaf996d5335e2a	6a3b2c03ca622cf6e4cc3290	Angels Pizza	dennissarte@gmail.com	t	f	Laoag CIty	AP Laoag
6a4b3f0eeba30f0e566402d8	2026-07-06 05:37:18.1+00	2026-07-06 05:37:18.1+00	6979737791aaf996d5335e2a	6a3b2c03ca622cf6e4cc3290	Angels Pizza	dennissarte@gmail.com	t	f	Baguio City	AP Baguio
6a4b3f01c72b7c6880ab2310	2026-07-06 05:37:05.193+00	2026-07-06 05:39:05.306+00	6979737791aaf996d5335e2a	6a3b2c03ca622cf6e4cc3290	Angels Pizza	dennissarte@gmail.com	t	f	San Fernando La Union	AP La Union
6a4b3ed92a408be5c891263f	2026-07-06 05:36:25.782+00	2026-07-06 05:36:46.39+00	6979737791aaf996d5335e2a	6a3b2c03ca622cf6e4cc3290	Angels Pizza	dennissarte@gmail.com	t	f	Quezon City	AP Aurora
6a4b3ec89b0de7253c253564	2026-07-06 05:36:08.038+00	2026-07-06 05:36:08.038+00	6979737791aaf996d5335e2a	6a3b2c03ca622cf6e4cc3290	Angels Pizza	dennissarte@gmail.com	t	f	Malate Manila City	AP Malate
6a4b3eb4291cd56be1395d73	2026-07-06 05:35:48.425+00	2026-07-06 05:35:48.425+00	6979737791aaf996d5335e2a	6a3b2c03ca622cf6e4cc3290	Angels Pizza	dennissarte@gmail.com	t	f	Quezon City	AP Retiro
6a4b3e6c6b60f051e41c4a12	2026-07-06 05:34:36.814+00	2026-07-06 05:34:36.814+00	6979737791aaf996d5335e2a	6a3b2c03ca622cf6e4cc3290	Angels Pizza	dennissarte@gmail.com	t	f	Silang Cavite	AP SILANG
6a3b2dd822c8fad40fcecae0	2026-06-24 01:07:36.874+00	2026-06-24 01:07:36.874+00	6979737791aaf996d5335e2a	6a3b2dab75f1bfaab440b521	Figaro Coffee	dennissarte@gmail.com	t	f	Quezon City	Trinoma
6a3b2dc94a1650ec8b98be59	2026-06-24 01:07:21.161+00	2026-07-06 05:34:45.501+00	6979737791aaf996d5335e2a	6a3b2c03ca622cf6e4cc3290	Angels Pizza	dennissarte@gmail.com	t	f	Makati City	AP Bel Air
6a3b2dba267128116f59fd03	2026-06-24 01:07:06.467+00	2026-07-06 05:35:01.968+00	6979737791aaf996d5335e2a	6a3b2c03ca622cf6e4cc3290	Angels Pizza	dennissarte@gmail.com	t	f	Madaluyong City	AP Mayon
\.


--
-- Data for Name: ticket_comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."ticket_comments" ("id", "created_date", "updated_date", "created_by_id", "attachment_urls", "author_email", "author_name", "content", "created_by", "is_internal", "is_sample", "ticket_id") FROM stdin;
\.


--
-- Data for Name: ticket_feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."ticket_feedback" ("id", "created_date", "updated_date", "created_by_id", "assigned_to", "comment", "created_by", "department_id", "department_name", "is_sample", "rating", "submitter_email", "ticket_id", "ticket_title") FROM stdin;
\.


--
-- Data for Name: ticket_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."ticket_rules" ("id", "created_date", "updated_date", "created_by_id", "name", "description", "is_active", "order", "conditions", "actions", "created_by", "is_sample") FROM stdin;
\.


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."tickets" ("id", "created_date", "updated_date", "created_by_id", "approval_status", "approved_at", "approver_email", "approver_name", "assigned_to", "attachment_url", "category_id", "category_name", "created_by", "department_id", "department_name", "description", "escalated", "escalated_at", "first_response_at", "handling_department_id", "handling_department_name", "handling_history", "image_urls", "is_sample", "priority", "rejection_reason", "resolved_at", "sla_id", "sla_resolution_breached", "sla_resolution_due", "sla_response_breached", "sla_response_due", "status", "store_name", "submitter_email", "submitter_name", "title", "audit_submission_id", "audit_template_id") FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."users" ("id", "created_date", "updated_date", "created_by_id", "app_role", "app_id", "assigned_stores", "brand_id", "collaborator_role", "department_id", "department_name", "disabled", "disabled_reason", "display_name", "email", "email_verified", "force_password_reset", "full_name", "is_email_verified", "is_service", "is_verified", "phone", "role", "store_name", "user_type", "verified") FROM stdin;
6a4c71c7252a009aed2190f4	2026-07-07 03:25:59.776+00	2026-07-07 03:43:23.261+00	\N	user	6979737791aaf996d5335e29	["AP La Union", "AP Baguio", "AP Laoag", "AP Cauayan", "AP TUGUEGARAO", "AP Agoo"]	\N	\N	6a420012041f3968458e3b36	SOD	f	\N	Tiff Caccam	tiff.sod.figaro@gmail.com	\N	f	tiff.sod.figaro	\N	f	t		user	\N	store_manager	\N
6a4c5985f4d87e807c4c5a19	2026-07-07 01:42:29.103+00	2026-07-07 02:27:14.822+00	\N	user	6979737791aaf996d5335e29	["AP SILANG", "AP Retiro", "AP Malate", "AP Aurora"]	\N	\N	6a420012041f3968458e3b36	SOD	f	\N	Davier Bautista	bautistadanvier01@gmail.com	\N	f	bautistadanvier01	\N	f	t	+639688690505	user	\N	store_manager	\N
6a4bc9babfd22522fcd999c3	2026-07-06 15:28:58.628+00	2026-07-08 07:04:00.982+00	\N	user	6979737791aaf996d5335e29	[]	\N	\N	6a420012041f3968458e3b36	SOD	f	\N	AP CAUAYAN	angelspizza2025cauayan@gmail.com	\N	f	angelspizza2025cauayan	\N	f	t	09517604391	user	AP Cauayan	user	\N
6a4bb74800a183144f2226f8	2026-07-06 14:10:16.477+00	2026-07-06 14:13:56.654+00	\N	user	6979737791aaf996d5335e29	[]	\N	\N	6a420012041f3968458e3b36	SOD	f	\N	AP RETIRO	retiroangelspizza2021@gmail.com	\N	f	retiroangelspizza2021	\N	f	t	09606912653	user	AP Retiro	user	\N
6a4ba70e12927b9568a2b072	2026-07-06 13:01:02.894+00	2026-07-06 13:04:40.582+00	\N	user	6979737791aaf996d5335e29	[]	\N	\N	697974464f1fb25c5716c684	Purchasing	f	\N	AP Malate	angelspizzamalate3@gmail.com	\N	f	angelspizzamalate3	\N	f	t	9202038049	user	AP Malate	user	\N
6a4de5eba5db7853a4d60632	2026-07-08 05:53:47.167+00	2026-07-14 07:04:15.837+00	\N	user	6979737791aaf996d5335e29	["AP Agoo", "AP TUGUEGARAO", "AP Laoag", "AP Cauayan", "AP Baguio", "AP La Union", "AP Malate", "AP Aurora", "AP SILANG", "AP Retiro", "AP Bel Air", "AP Mayon"]	\N	\N	6a420012041f3968458e3b36	SOD	f	\N	John Lenard Lim	lenard@figaro.ph	\N	f	lenard	\N	f	t	09478990001	user	\N	store_manager	\N
6a4b975beb1e163287b191d1	2026-07-06 11:54:03.3+00	2026-07-06 12:43:58.311+00	\N	user	6979737791aaf996d5335e29	[]	\N	\N	6a420012041f3968458e3b36	SOD	f	\N	AP AURORA	angelspizzaaurora@gmail.com	\N	f	angelspizzaaurora	\N	f	t	09242134182	user	AP Aurora	user	\N
6a4b93173a8d82b84cb9a6e3	2026-07-06 11:35:51.881+00	2026-07-06 11:37:41.43+00	\N	user	6979737791aaf996d5335e29	[]	\N	\N	6a420012041f3968458e3b36	SOD	f	\N	AP BAGUIO	angelspizzabaguio@gmail.com	\N	f	angelspizzabaguio	\N	f	t	09950452982	user	AP Baguio	user	\N
6a4b915e7348a42d4f959592	2026-07-06 11:28:30.131+00	2026-07-06 11:32:58.361+00	\N	user	6979737791aaf996d5335e29	[]	\N	\N	6a420012041f3968458e3b36	SOD	f	\N	AP TUGUEGARAO	tuguegaraoangelspizza@gmail.com	\N	f	tuguegaraoangelspizza	\N	f	t	09950451764	user	AP TUGUEGARAO	user	\N
6a4b91163443a4629d1d8a5f	2026-07-06 11:27:18.372+00	2026-07-07 01:17:03.617+00	\N	user	6979737791aaf996d5335e29	[]	\N	\N	6a420012041f3968458e3b36	SOD	f	\N	AP AGOO	apagoo2024@gmail.com	\N	f	apagoo2024	\N	f	t	09544592501	user	AP Agoo	user	\N
6a4b8facd96e697354115b3a	2026-07-06 11:21:16.846+00	2026-07-06 11:33:32.145+00	\N	user	6979737791aaf996d5335e29	[]	\N	\N	6a420012041f3968458e3b36	SOD	f	\N	AP LAUNION	launionangelspizza2023@gmail.com	\N	f	launionangelspizza2023	\N	f	t	09272275779	user	AP La Union	user	\N
6a4b8c99c45cc37bcde76671	2026-07-06 11:08:09.587+00	2026-07-06 11:10:34.284+00	\N	user	6979737791aaf996d5335e29	[]	\N	\N	6a420012041f3968458e3b36	SOD	f	\N	AP LAOAG	angelspizzalaoag30@gmail.com	\N	f	angelspizzalaoag30	\N	f	t	09958267846	user	AP Laoag	user	\N
6a4b8463e31978bde696a097	2026-07-06 10:33:07.613+00	2026-07-06 10:36:07.619+00	\N	user	6979737791aaf996d5335e29	[]	\N	\N	6a420012041f3968458e3b36	SOD	f	\N	AP SILANG	angelspizzasilang@gmail.com	\N	f	angelspizzasilang	\N	f	t	09157551572	user	AP SILANG	user	\N
6a4b40631d7e5391dddeb504	2026-07-06 05:42:59.311+00	2026-07-07 01:21:46.067+00	\N	admin	6979737791aaf996d5335e29	[]	\N	\N	697974464f1fb25c5716c681	MIS	f	\N	John Marco Rafol	marco@figaro.ph	\N	f	marco	\N	f	t	09177038204	admin	\N	admin	\N
6a461e91397f605e1451b349	2026-07-02 08:17:21.718+00	2026-07-08 01:16:25.002+00	\N	user	6979737791aaf996d5335e29	[]	\N	\N	697974464f1fb25c5716c681	MIS	f	\N	Renz	estillosorenz@gmail.com	\N	f	estillosorenz	\N	f	t	+639206305889	user	\N	department_head	\N
6a3b4af83b7553cbf4b3da2d	2026-06-24 03:11:52.138+00	2026-07-09 13:09:51.673+00	\N	user	6979737791aaf996d5335e29	[]	\N	\N	6a420012041f3968458e3b36	SOD	f	\N	Trinoma	contact@figaro.ph	t	f	contact	t	f	t	09171623922	user	Trinoma	user	t
69897f43b7bcb0230913d62c	2026-02-09 06:31:31.467+00	2026-07-09 13:33:08.121+00	\N	user	6979737791aaf996d5335e29	["Trinoma", "AP Agoo", "AP TUGUEGARAO", "AP Cauayan", "AP Laoag", "AP Baguio", "AP La Union", "AP Aurora", "AP Retiro", "AP SILANG", "AP Bel Air", "AP Mayon", "AP Malate"]	\N	\N	6a420012041f3968458e3b36	SOD	f	\N	annamariesarte28	annamariesarte28@gmail.com	t	f	annamariesarte28	t	f	t	09171234567	user	\N	store_manager	t
69893e799cdf1f4d243c6700	2026-02-09 01:55:05.042+00	2026-07-08 01:23:40.44+00	\N	user	6979737791aaf996d5335e29	[]	\N	\N	697974464f1fb25c5716c681	MIS	f	\N	Ramon Valdez Jr.	ramonmvaldez0205@gmail.com	t	f	ramonmvaldez0205	t	f	t	09360664823	user	\N	department_head	t
698159d50d963bd0205597b5	2026-02-03 02:13:41.655+00	2026-07-09 13:25:16.787+00	\N	user	6979737791aaf996d5335e29	["Trinoma", "AP Agoo", "AP TUGUEGARAO", "AP Cauayan", "AP Laoag"]	\N	\N	6a420012041f3968458e3b36	SOD	f	\N	data privacy	dataprivacy@figaro.ph	t	f	data privacy	t	f	t	0917234567	user	\N	store_manager	t
6a3c96f68d24153e909aa512	2026-06-25 02:48:22.687+00	2026-06-30 00:24:49.735+00	\N	user	6979737791aaf996d5335e29	[]	\N	\N	6a3b36e262dd0fe3bc2085d9	Quality Assurance	f	\N	\N	angel@figaro.ph	t	f	Angel Galang	t	f	t	+639171235556	user	\N	user	t
6996568803ec76188ec8cfe8	2026-02-19 00:17:12.537+00	2026-06-30 00:24:50.002+00	\N	user	6979737791aaf996d5335e29	[]	\N	\N	697974464f1fb25c5716c681	MIS Support	f	\N	\N	benigerick@gmail.com	t	f	erick benig	t	f	t	09983079298	user	\N	user	t
6979baa957303cc58ddc1617	2026-01-28 07:28:41.094+00	2026-06-30 00:24:50.593+00	\N	user	6979737791aaf996d5335e29	[]	\N	\N	697974464f1fb25c5716c684	Purchasing	f	\N	\N	figarocoffeegroup@gmail.com	t	f	figarocoffeegroup	t	f	t	09171234567	user	\N	department_head	t
6979737791aaf996d5335e2a	2026-01-28 02:24:55.987+00	2026-06-30 00:24:50.879+00	\N	admin	6979737791aaf996d5335e29	[]	\N	editor	697974464f1fb25c5716c681	MIS Support	f	\N	\N	dennissarte@gmail.com	t	f	dennis sarte	t	f	t	+639171623952	admin	\N	admin	t
b8366053-8751-4743-972d-ca3d33979be3	2026-07-14 06:59:27.546+00	2026-07-14 07:02:47.005+00	\N	user	\N	[]	\N	\N	697974464f1fb25c5716c681	MIS	f	\N	Albert Lazarte	albertlazarte151989@gmail.com	t	\N	Albert Lazarte	\N	\N	t	09171234567	user	\N	department_head	t
69797a40e36b0e3c312de1b9	2026-01-28 02:53:52.095+00	2026-07-17 08:40:21.815+00	\N	user	6979737791aaf996d5335e29	[]	\N	\N	697974464f1fb25c5716c681	MIS	f	Disabled from Admin > Users	Dennis Sarte	dennis@figaro.ph	f	f	Dennis Sarte	t	f	f	09171623952	user	\N	department_head	f
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") FROM stdin;
attachments	attachments	\N	2026-07-13 06:48:32.195576+00	2026-07-13 06:48:32.195576+00	t	f	\N	\N	\N	STANDARD
\.


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets_analytics" ("name", "type", "format", "created_at", "updated_at", "id", "deleted_at") FROM stdin;
\.


--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets_vectors" ("id", "type", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."objects" ("id", "bucket_id", "name", "owner", "created_at", "updated_at", "last_accessed_at", "metadata", "version", "owner_id", "user_metadata") FROM stdin;
f5f48f5b-1a77-4f5b-a26a-346b910392ba	attachments	2026-07-14/6a6be7a2-a88f-4e9d-a383-b0a6a19bcad4-photo_1783991815104.jpg	b31f1731-7283-4c8e-8b36-4c2659aa558f	2026-07-14 01:16:55.684541+00	2026-07-14 01:16:55.684541+00	2026-07-14 01:16:55.684541+00	{"eTag": "\\"f409f64203afca436d90396e70875f48\\"", "size": 54526, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-14T01:16:56.000Z", "contentLength": 54526, "httpStatusCode": 200}	c81360b7-da4d-45d8-8125-58c6143d9bb7	b31f1731-7283-4c8e-8b36-4c2659aa558f	{}
9aa43955-646b-448a-bdfc-d55b724ed813	attachments	2026-07-15/8a785d6d-6f02-46d7-b8d9-e0a7224052fb-Screenshot_2026-02-24_at_11.44.14_am.jpg	b31f1731-7283-4c8e-8b36-4c2659aa558f	2026-07-15 12:41:03.802046+00	2026-07-15 12:41:03.802046+00	2026-07-15 12:41:03.802046+00	{"eTag": "\\"40cd742c7fb385bdef076890e64949a1\\"", "size": 93693, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-15T12:41:04.000Z", "contentLength": 93693, "httpStatusCode": 200}	785f2446-638a-4bd0-a85c-daf9b6b2c972	b31f1731-7283-4c8e-8b36-4c2659aa558f	{}
41d17915-1cf2-41b9-94c4-4801e206f432	attachments	2026-07-15/8d3aff25-6fd8-4000-8d2a-33646207d63c-Screenshot_2026-02-24_at_11.44.14_am.jpg	1ac8122a-0912-49bb-b7a8-fbd2d6809a07	2026-07-15 12:54:04.027705+00	2026-07-15 12:54:04.027705+00	2026-07-15 12:54:04.027705+00	{"eTag": "\\"40cd742c7fb385bdef076890e64949a1\\"", "size": 93693, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-15T12:54:04.000Z", "contentLength": 93693, "httpStatusCode": 200}	4ccfcfc4-bfdb-4e6f-b80c-7c5173f9302f	1ac8122a-0912-49bb-b7a8-fbd2d6809a07	{}
461baff5-f353-454d-a3da-86a8934ed45c	attachments	2026-07-15/0c97576b-2a42-4252-8422-7df26ac642e7-photo_1784120062396.jpg	1ac8122a-0912-49bb-b7a8-fbd2d6809a07	2026-07-15 12:54:22.593669+00	2026-07-15 12:54:22.593669+00	2026-07-15 12:54:22.593669+00	{"eTag": "\\"e144504aff633058be052b872cf3e536\\"", "size": 35953, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-15T12:54:23.000Z", "contentLength": 35953, "httpStatusCode": 200}	a2eaab22-07d8-4e75-9ade-360f808f4983	1ac8122a-0912-49bb-b7a8-fbd2d6809a07	{}
bd28b282-eb83-4f21-992a-8e7cea11464f	attachments	2026-07-15/eb7a8968-2d55-48be-aca2-7688609a40a4-Screenshot_2026-02-26_at_6.38.22_pm.jpg	1ac8122a-0912-49bb-b7a8-fbd2d6809a07	2026-07-15 12:54:43.578501+00	2026-07-15 12:54:43.578501+00	2026-07-15 12:54:43.578501+00	{"eTag": "\\"c14f200d6e87b6279c0000a28838c4ab\\"", "size": 70089, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-15T12:54:44.000Z", "contentLength": 70089, "httpStatusCode": 200}	4a9c2101-8efb-49af-986c-cf35a465ad91	1ac8122a-0912-49bb-b7a8-fbd2d6809a07	{}
d221c707-6fd3-49df-acd1-dbac40b7f8c7	attachments	2026-07-15/9e201755-ae10-4792-b62c-19f41504a8ba-Screenshot_2026-02-26_at_6.38.22_pm.jpg	1ac8122a-0912-49bb-b7a8-fbd2d6809a07	2026-07-15 12:54:47.646064+00	2026-07-15 12:54:47.646064+00	2026-07-15 12:54:47.646064+00	{"eTag": "\\"c14f200d6e87b6279c0000a28838c4ab\\"", "size": 70089, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-15T12:54:48.000Z", "contentLength": 70089, "httpStatusCode": 200}	24f8bd3b-5e41-4136-9613-2fd81c0f3d96	1ac8122a-0912-49bb-b7a8-fbd2d6809a07	{}
\.


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."s3_multipart_uploads" ("id", "in_progress_size", "upload_signature", "bucket_id", "key", "version", "owner_id", "created_at", "user_metadata", "metadata") FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."s3_multipart_uploads_parts" ("id", "upload_id", "size", "part_number", "bucket_id", "key", "etag", "owner_id", "version", "created_at") FROM stdin;
\.


--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."vector_indexes" ("id", "name", "bucket_id", "data_type", "dimension", "distance_metric", "metadata_configuration", "created_at", "updated_at") FROM stdin;
\.


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 113, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict yAJbokwqZgdU5l7gsS0RV6Fm4QvZO9sKl6B3StJyX9pZeHlwcogQIZe5truLSJx

RESET ALL;
