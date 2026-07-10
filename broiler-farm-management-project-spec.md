# Broiler Farm Management Platform — Project Specification

## 1. Project Overview

This project is a web application (mobile-responsive, PWA-capable) for managing broiler poultry farm operations. It has two phases that share the same codebase and data model:

- **Phase A — Internal Tool**: Built first and used by one real business — a poultry operation with 4 broiler sheds — to track daily operations, flock health, feed efficiency, and financials per shed/batch.
- **Phase B — Multi-Tenant SaaS**: The same tool opened up as a subscription product for other broiler farmers, with account isolation, role-based access, and billing.

Phase A must be fully functional and validated with real daily use before Phase B work (multi-tenancy, billing, onboarding) begins. The data model should be designed with Phase B in mind from the start (i.e., everything scoped under a `farm_id`) so no migration/rewrite is needed later.

## 2. Goals

1. Replace manual/paper record-keeping for a 4-shed broiler operation with a fast, reliable digital log.
2. Surface feed efficiency (FCR) and growth performance early enough in each batch cycle to catch problems before harvest.
3. Give the farm owner a single dashboard to compare performance across sheds and batches.
4. Package the validated tool as a subscription product for other broiler farmers, priced and localized for the Pakistani market.

## 3. Users & Roles

| Role | Description | Permissions |
|---|---|---|
| **Platform Admin** | You — owns the SaaS platform | Manage all tenant accounts, subscriptions, billing, support |
| **Farm Owner** | Owns a farm account (e.g., your father) | Full access to all sheds/batches/financials under their farm |
| **Farm Manager** | Delegated manager | Access to operations + financials, no billing/account settings |
| **Worker** | Shed-level staff | Can submit daily logs (mortality, feed, temp) for assigned shed(s) only; no financial visibility |

## 4. Core Domain Concepts

- **Farm**: A tenant/business account. Owns multiple sheds.
- **Shed**: A physical broiler house belonging to a farm. Has a capacity and location.
- **Batch**: One broiler production cycle in a shed, from chick placement to harvest (typically 35–45 days). A shed has one active batch at a time, and a full history of past batches.
- **Daily Log**: One entry per shed per day during an active batch — mortality, feed given, water, environment readings.
- **Weight Sample**: Periodic bird weighing during a batch, used to plot actual growth vs. the breed's standard growth curve.
- **Expense**: A cost entry tied to a batch (chicks, feed, medicine, labor, utilities).
- **Sale/Harvest Record**: The batch's closing record — buyer, weight sold, rate per kg, condemned/rejected birds, closing date.

## 5. Data Model

```
users
 - id, name, phone, email, password_hash, role, farm_id (nullable for platform admin), created_at

farms
 - id, name, owner_user_id, subscription_tier, subscription_status, created_at

farm_members
 - id, farm_id, user_id, role (owner/manager/worker), assigned_shed_ids[]

sheds
 - id, farm_id, name, capacity, location, created_at

batches
 - id, shed_id, breed, placement_date, starting_bird_count,
   target_harvest_weight, status (active/harvested/closed), created_at

daily_logs
 - id, batch_id, log_date, mortality_count, feed_given_kg,
   feed_stock_remaining_kg, water_consumption_l, temperature_c,
   humidity_pct, notes, logged_by_user_id

weight_samples
 - id, batch_id, sample_date, sample_size, avg_weight_g

vaccinations
 - id, batch_id, vaccine_name, scheduled_date, completed_date, status, notes

expenses
 - id, batch_id, category (chicks/feed/medicine/labor/utilities/other),
   amount, expense_date, notes

sales
 - id, batch_id, buyer_name, sale_date, total_weight_kg,
   rate_per_kg, condemned_birds_count, total_amount

subscriptions
 - id, farm_id, plan (free/basic/pro), status, start_date, next_billing_date, payment_method

alerts
 - id, farm_id, shed_id, type (mortality_spike/vaccination_due/low_feed_stock),
   message, triggered_at, resolved_at
```

Every table below `farms` is scoped by `farm_id` (directly or via `shed_id → farm_id`), so Postgres row-level security (RLS) can enforce tenant isolation cleanly once Phase B begins.

## 6. Feature List

### 6.1 Shed & Batch Management
- Create/edit sheds (name, capacity, location)
- Start a new batch on a shed: breed, placement date, starting bird count, target harvest weight
- View batch status: current day of cycle, days remaining to target harvest
- Close out a batch (triggers harvest/sale record)
- Full batch history per shed

### 6.2 Daily Operations Logging
- One fast-entry screen per shed per day: mortality count, feed given (kg), feed stock remaining, water consumption, temperature, humidity, free-text notes
- Running totals: cumulative mortality, cumulative feed used, mortality % of starting count
- This screen is the most frequently used in the app — optimize for minimal taps and large touch targets, since it will primarily be filled in by shed workers on a phone

### 6.3 Growth & Feed Efficiency
- Periodic weight sampling (e.g., every 7 days): sample size + average weight
- Auto-calculated FCR = cumulative feed consumed ÷ cumulative weight gained
- Graph: actual growth curve vs. standard breed growth curve (e.g., Ross 308, Cobb 500 reference tables), so underperformance is visible mid-cycle, not just at harvest

### 6.4 Health Management
- Vaccination/medication schedule with due dates (e.g., Newcastle, Gumboro)
- Mark scheduled items as completed with a completion date
- Mortality spike detection: flag when a day's mortality exceeds a threshold (e.g., 2x the batch's rolling 3-day average)

### 6.5 Financials
- Log expenses per batch by category (chicks, feed, medicine, labor, utilities, other)
- Record the harvest/sale: buyer, total weight sold, rate per kg, condemned birds, total amount
- Auto-calculated profit/loss per batch (revenue − total expenses)
- Cost-per-bird and cost-per-kg metrics

### 6.6 Dashboard & Reporting
- Multi-shed overview: for all 4 sheds side by side — current batch day, mortality %, FCR, days to harvest
- Historical comparison: this batch vs. past batches in the same shed (mortality, FCR, profit trends over time)
- Exportable PDF/Excel reports per batch and per shed

### 6.7 Alerts & Notifications
- Mortality spike alerts
- Vaccination/medication due-date reminders
- Low feed stock warnings
- Delivered via WhatsApp Business API or SMS (more reliable for farm workers than in-app push notifications), in addition to in-app alerts

### 6.8 Multi-Tenancy & Access Control (Phase B)
- Farm-level accounts with data fully isolated between farms (enforced via RLS)
- Role-based access: Owner, Manager, Worker — see section 3 for permission boundaries
- Ability for a farm owner to invite additional users (family members, farmhands) to their farm account

### 6.9 Subscription & Billing (Phase B)
- Tiered plans: Free (1 shed, basic logging) → Paid tiers (multiple sheds, full analytics, alerts, reports)
- Local payment integration: JazzCash / EasyPaisa
- Platform admin panel: view all tenant farms, subscription status, usage, support tickets

### 6.10 Localization & Offline Support
- Urdu and English language toggle
- Offline-first data entry (PWA with local caching) — daily logs can be entered without an internet connection and sync automatically when connectivity returns; critical given rural shed connectivity is often unreliable

### 6.11 Phase 2 — AI Features

AI features are built after Phase A (sections 6.1–6.10) is live and validated, so they have real data and real usage to build on. The primary AI feature is a farm data assistant (chatbot); mortality risk prediction is a secondary feature to build once enough batch history has accumulated.

#### 6.11.1 Farm Data Assistant (Primary AI Feature)

A chatbot the farm owner/manager can ask natural-language questions, in Urdu or English, about their own farm's data and general broiler knowledge. This is the priority AI feature because it doesn't depend on accumulating years of historical data the way a prediction model would — it can be built as soon as Phase A's data model exists.

**Two information sources, not one:**
- **Tool-use over structured farm data**: the chatbot must call functions/tools that query the actual Postgres tables (batches, daily_logs, weight_samples, expenses, sales) — e.g., "what was shed 2's FCR last batch?" or "how does this batch's mortality compare to shed 3's last cycle?" should be answered from a live database query, not a canned response. This is what separates it from a generic chatbot wrapper and gives it real analytical value.
- **Retrieval-augmented generation (RAG) over reference knowledge**: a smaller knowledge base of broiler reference material (breed growth standards, vaccination guidelines, general disease/FCR benchmarks) that the chatbot retrieves from via embeddings + vector search to answer general poultry questions not specific to the farm's own data.

**Design requirements:**
- Function-calling architecture: define a fixed set of callable tools (e.g., `get_batch_summary(batch_id)`, `get_shed_history(shed_id)`, `compare_batches(batch_id_1, batch_id_2)`, `get_expense_breakdown(batch_id)`) rather than giving the model free-form database access — this keeps queries safe, scoped, and auditable.
- Tenant scoping: every tool call must be scoped to the requesting user's `farm_id`, enforced server-side, so the chatbot can never answer with another farm's data.
- Role awareness: a worker-role user asking the chatbot a financial question should get the same access restriction as they would in the UI (no financial data exposure).
- Language: must handle Urdu and English input/output.

**Evaluation plan (needed for this to count as rigorous ML/AI work, not just prompt engineering):**
- Build a small labeled test set of realistic farm questions with known-correct answers (e.g., 30–50 Q&A pairs spanning both tool-use questions and RAG questions).
- Measure retrieval relevance (did the RAG step pull the right reference chunk) separately from answer correctness (did the final response actually answer correctly).
- Track and document embedding model choice, chunking strategy, and function-calling schema design as part of the writeup — these are the pieces that demonstrate actual technical decision-making, not just "connected to an LLM API."

#### 6.11.2 Mortality Risk Prediction (Secondary AI Feature)

Once enough batch cycles have accumulated across the 4 sheds (and ideally more once other farms are onboarded in Phase B) to support real train/test evaluation, replace the rule-based mortality-spike alert (section 6.7) with a learned model — a gradient-boosted classifier (XGBoost/LightGBM) trained on rolling mortality, feed intake, and environment features, predicting elevated mortality risk in the next 1–3 days. Evaluate with precision/recall on early-warning detection, not just accuracy, since false negatives (missed outbreaks) are far costlier than false positives here.

#### 6.11.3 Other Future Differentiators
- IoT sensor integration for automatic temperature/humidity/ammonia logging (replacing manual entry)
- Live feed and market bird price feed
- Marketplace module connecting farmers to feed suppliers or bird buyers
- Harvest weight / FCR forecasting model, once sufficient batch history exists
- Compliance/traceability records for farmers selling to larger processors or exporters

## 7. Technical Architecture

- **Frontend**: Next.js (React), mobile-first responsive design, configured as a PWA for offline caching and "install to home screen" support
- **Backend & Database**: Supabase — Postgres database, built-in Auth, file storage, and Row-Level Security for tenant data isolation
- **Notifications**: WhatsApp Business API (preferred) or Twilio for SMS-based alerts
- **Payments**: JazzCash / EasyPaisa API integration for subscription billing
- **Hosting**: Vercel (frontend) + Supabase (backend), both scale on low-cost tiers appropriate for an early-stage product

## 8. Non-Functional Requirements

- **Speed of data entry**: the daily log screen must be usable in under 60 seconds by a shed worker on a basic smartphone
- **Offline reliability**: no data loss if connectivity drops mid-entry
- **Tenant data isolation**: enforced at the database level (RLS), not just application logic, once multi-tenancy is added
- **Localization**: all user-facing text available in Urdu and English
- **Security**: role-based permissions enforced server-side; workers must never be able to view financial data via API even if the UI hides it

## 9. Data Quality Standards (for Future ML Work)

AI/ML features are deferred to a later phase (see section 6.11), but the data collected during Phase A becomes the foundation for that future work. This matters for both AI features: the farm data assistant's function-calling tools query these tables directly and are only as useful as the data is clean and complete, and mortality-risk prediction / harvest-weight forecasting depend on clean, consistent historical daily logs, weight samples, and mortality records. Data quality cannot be fixed retroactively once a batch cycle has passed, so the following standards apply from the very first batch onward, even though no AI is being built yet:

- **Consistency**: daily logs should be entered every single day of an active batch, with no gaps — missing days create holes in the time series that a future model would otherwise need to train on.
- **Standardized units**: feed in kg, weight in grams, temperature in °C — enforced at the input/schema level, not left to free text, so values are usable without cleanup later.
- **Required vs. optional fields**: mortality count, feed given, and feed stock remaining should be required on every daily log; temperature/humidity can be optional early on but should be filled in as consistently as possible once environment tracking is in place.
- **Timestamped, attributable entries**: every log should record which user submitted it and when, not just the log_date — useful for later data-quality auditing (e.g., spotting a worker who consistently logs late or estimates rather than measures).
- **No silent overwrites**: corrections to a submitted log should be recorded as an edit history rather than overwriting the original value, so a future model isn't trained on silently "cleaned" data that doesn't reflect what was actually observed.
- **Batch metadata completeness**: breed, placement date, and starting bird count must be captured accurately for every batch, since they're the baseline every downstream growth/FCR calculation and future model depends on.

## 10. Step-by-Step Implementation Sequence

1. **Set up the data foundation** — implement the schema in section 5 (farms, sheds, batches, daily_logs at minimum). Build shed creation and batch-start flows.
2. **Build the daily operations logging screen** — this is the highest-frequency screen in the app; build and refine it before anything else consumes development time.
3. **Deploy for one live batch** — get the tool used on an actual ongoing batch in one real shed. Use this to find gaps in the plan before building further.
4. **Add growth & feed efficiency tracking** — weight sampling entry, auto-calculated FCR, growth curve chart vs. breed standard.
5. **Add financial tracking** — expense logging per batch, harvest/sale recording, auto profit/loss calculation.
6. **Build the multi-shed dashboard** — side-by-side shed comparison view, plus historical batch-over-batch comparison per shed.
7. **Add alerting** — mortality spike detection, vaccination due-date reminders, low feed stock warnings; wire these to WhatsApp/SMS delivery.
8. **Add reporting** — exportable PDF/Excel reports per batch and per shed.
9. **Add multi-tenancy** — farm-level account structure, RLS-based data isolation, role-based access (owner/manager/worker), user invitations.
10. **Add subscription & billing** — tiered plans, JazzCash/EasyPaisa integration, platform admin panel for managing tenant accounts.
11. **Onboard external farmers** — begin with contacts in the farm owner's existing network (feed dealers, poultry association contacts, WhatsApp farmer groups).
12. **Build the farm data assistant (primary AI feature)** — function-calling tools over the farm's own structured data (batch, shed, expense queries), RAG over broiler reference knowledge, tenant/role-scoped access, and a labeled evaluation set to measure retrieval relevance and answer correctness.
13. **Build mortality risk prediction (secondary AI feature)** — once enough batch history has accumulated to support real train/test evaluation, replace the rule-based mortality-spike alert with a trained classifier.
14. **Build remaining Phase 2 differentiators** — IoT sensor integration, market price feed, marketplace module, harvest weight/FCR forecasting.

Steps 1–8 produce a fully functional single-farm tool with no dependency on the steps that follow. Steps 9–11 turn that validated tool into a sellable multi-tenant product. Steps 12–14 layer AI features on top, once real usage data exists to build and evaluate them against.

## 11. Success Criteria

- **Phase A**: The farm owner uses the tool daily across all 4 sheds for at least 2 full batch cycles without reverting to manual records; FCR and mortality data are accurate enough to inform real decisions.
- **Phase B**: At least one external farm onboarded and retained through a full billing cycle; tenant data isolation verified (no cross-farm data leakage); daily log entry works offline and syncs correctly.

## 12. Appendix — Sample Core User Flow (Worker, Daily Log)

1. Worker opens app on phone, selects their assigned shed.
2. App shows the active batch and current day of cycle.
3. Worker enters: mortality count, feed given, feed stock remaining, temperature/humidity, optional notes.
4. If offline, entry is cached locally and a "pending sync" indicator is shown.
5. On submit (or reconnect), data syncs to the batch's daily_logs; running totals (cumulative mortality, cumulative feed) update automatically.
6. If mortality count triggers the spike threshold, an alert is generated and routed to the farm owner via WhatsApp/SMS.
