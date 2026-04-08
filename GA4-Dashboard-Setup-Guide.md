# Elvenwood Interiors — GA4 Dashboard & GTM Setup Guide

## Step 1: Connect GTM to GA4 (if not already done)

Your GTM container is **GTM-WP27LKHN**. You need a GA4 property connected to it.

### If you DON'T have GA4 yet:
1. Go to https://analytics.google.com
2. Click **Admin** (gear icon) → **Create Property**
3. Property name: "Elvenwood Interiors Website"
4. Time zone: India (GMT+5:30), Currency: INR
5. Industry: Home & Garden
6. Business size: Small
7. Create → Get your **Measurement ID** (starts with G-XXXXXXXX)

### Connect GA4 to GTM:
1. Go to https://tagmanager.google.com → Select GTM-WP27LKHN
2. **Tags** → **New** → **Google Analytics: GA4 Configuration**
3. Measurement ID: Your G-XXXXXXXX
4. Trigger: **All Pages**
5. Save → **Submit** → Publish

---

## Step 2: Create Custom Event Tags in GTM

The website now pushes these events to `dataLayer`. You need GTM tags to forward them to GA4.

### 2A. Create a Single GA4 Event Tag (recommended approach)

1. In GTM → **Triggers** → **New**:
   - Trigger name: "Custom Events - All Lead Gen"
   - Type: **Custom Event**
   - Event name: `whatsapp_click|phone_call_click|email_click|callback_form_submit|directions_click`
   - Check **"Use regex matching"**
   - Save

2. In GTM → **Tags** → **New**:
   - Tag name: "GA4 - Lead Generation Events"
   - Type: **Google Analytics: GA4 Event**
   - Configuration Tag: (select your GA4 config tag)
   - Event Name: `{{Event}}`
   - Event Parameters:
     - `event_category` → `{{DLV - event_category}}`
     - `event_label` → `{{DLV - event_label}}`
     - `page_name` → `{{DLV - page_name}}`
   - Trigger: "Custom Events - All Lead Gen"
   - Save

3. Create Data Layer Variables:
   For each parameter, go to **Variables** → **New** → **Data Layer Variable**:
   - Variable name: "DLV - event_category" → Data Layer Variable Name: `event_category`
   - Variable name: "DLV - event_label" → Data Layer Variable Name: `event_label`
   - Variable name: "DLV - page_name" → Data Layer Variable Name: `page_name`
   - Variable name: "DLV - link_url" → Data Layer Variable Name: `link_url`
   - Variable name: "DLV - scroll_percentage" → Data Layer Variable Name: `scroll_percentage`
   - Variable name: "DLV - time_seconds" → Data Layer Variable Name: `time_seconds`
   - Variable name: "DLV - page_type" → Data Layer Variable Name: `page_type`
   - Variable name: "DLV - page_url" → Data Layer Variable Name: `page_url`
   - Variable name: "DLV - referrer" → Data Layer Variable Name: `referrer`
   - Variable name: "DLV - click_location" → Data Layer Variable Name: `click_location`

4. Repeat for engagement events:
   - Trigger: Custom Event → `cta_click|scroll_depth|time_on_page|faq_click|area_page_click|social_click|project_view|enhanced_page_view` (regex)
   - Tag: "GA4 - Engagement Events" → Same structure

5. **Submit** → **Publish** the GTM container

### 2B. Quick Alternative: Use GTM's "All Custom Events" approach

If you want a simpler setup:
1. One trigger: Custom Event → `.*` (matches everything)
2. One tag: GA4 Event → Event Name: `{{Event}}` with all parameters
3. This forwards ALL custom events to GA4 automatically

---

## Step 3: Mark Conversions in GA4

Once events start flowing (within 24-48 hours):

1. Go to GA4 → **Admin** → **Events**
2. Find these events and toggle **"Mark as conversion"**:
   - `whatsapp_click` ← **PRIMARY CONVERSION (most important)**
   - `phone_call_click` ← **CONVERSION**
   - `callback_form_submit` ← **CONVERSION**
   - `email_click` ← **CONVERSION**
   - `directions_click` ← **CONVERSION**

---

## Step 4: Build the Dashboard

### GA4 → Reports → Library → Create New Report Collection: "Elvenwood Lead Gen"

### Report 1: Lead Generation Overview

**Create Custom Exploration:**
1. GA4 → **Explore** → **Blank**
2. Name: "Lead Generation Dashboard"
3. **Tab 1: Lead Summary** (Free-form)
   - Rows: `Event name` (filter to: whatsapp_click, phone_call_click, callback_form_submit, email_click, directions_click)
   - Values: `Event count`, `Total users`
   - Date range: Last 30 days

4. **Tab 2: Leads by Page**
   - Rows: `page_name` (custom dimension)
   - Columns: `Event name`
   - Values: `Event count`
   - Filter: Event name = whatsapp_click, phone_call_click, callback_form_submit

5. **Tab 3: Lead Source**
   - Rows: `Session source / medium`
   - Values: Event count (filtered to conversion events)
   - Shows: Which traffic sources generate the most leads

6. **Tab 4: Funnel - Visit to Lead**
   - Type: Funnel Exploration
   - Steps:
     1. `session_start` (page view)
     2. `scroll_depth` where scroll_percentage = 50
     3. `cta_click` OR `faq_click`
     4. `whatsapp_click` OR `phone_call_click` OR `callback_form_submit`

### Report 2: Page Performance

**Standard Reports → Engagement → Pages and Screens**
Key metrics to watch:
- Which pages have highest engagement (time, scroll depth)
- Which pages generate the most WhatsApp clicks
- Which area pages get the most traffic
- Bounce rate by page

### Report 3: Traffic Sources

**Standard Reports → Acquisition → Traffic Acquisition**
Key metrics:
- Organic search (are area pages getting traffic?)
- Direct (brand awareness)
- Referral (from directories once you list)
- Social (Instagram, Facebook once you set up)

---

## Step 5: Create Custom Dimensions in GA4

To see the custom parameters in reports:

1. GA4 → **Admin** → **Custom Definitions** → **Create Custom Dimension**
2. Create these:

| Dimension Name | Event Parameter | Scope |
|---|---|---|
| Page Name | page_name | Event |
| Event Label | event_label | Event |
| Event Category | event_category | Event |
| Page Type | page_type | Event |
| Link URL | link_url | Event |
| Click Location | click_location | Event |

3. Create **Custom Metrics** (Admin → Custom Definitions → Custom Metrics):

| Metric Name | Event Parameter | Scope | Unit |
|---|---|---|---|
| Scroll Percentage | scroll_percentage | Event | Standard |
| Time on Page Seconds | time_seconds | Event | Seconds |

---

## Step 6: Set Up Alerts

GA4 → **Admin** → **Custom Insights**

### Alert 1: Lead Drop Alert
- "Notify me when WhatsApp clicks decrease by more than 30% compared to same period last week"

### Alert 2: Traffic Spike Alert
- "Notify me when sessions increase by more than 50% compared to previous period"
- (Useful when area pages start ranking)

---

## Events Reference — What Gets Tracked

| Event Name | Category | When It Fires | What It Tells You |
|---|---|---|---|
| `whatsapp_click` | lead_generation | Any wa.me link clicked | **Primary lead metric** — how many people reach out |
| `phone_call_click` | lead_generation | Phone number clicked | Mobile users calling directly |
| `email_click` | lead_generation | Email link clicked | Email inquiries |
| `callback_form_submit` | lead_generation | EC form submitted | Callback requests |
| `directions_click` | lead_generation | Google Maps link clicked | People planning to visit |
| `cta_click` | engagement | Any CTA button clicked | Which CTAs work best |
| `scroll_depth` | engagement | User scrolls 25/50/75/100% | Content engagement |
| `time_on_page` | engagement | 30s / 60s / 2min / 5min | Deep engagement signal |
| `faq_click` | engagement | FAQ item clicked | What questions matter most |
| `area_page_click` | navigation | Area/pricing page link clicked | Internal navigation patterns |
| `social_click` | engagement | Instagram link clicked | Social interest |
| `project_view` | engagement | Portfolio project clicked | Which projects attract attention |
| `enhanced_page_view` | pageview | Page loads | Page type categorization |

---

## Key Metrics to Monitor Weekly

### Lead Generation KPIs
| Metric | How to Find | Target |
|---|---|---|
| Total WhatsApp clicks / week | Events → whatsapp_click | Growing week-over-week |
| WhatsApp clicks per page | Events → whatsapp_click → by page_name | Identify top-converting pages |
| Callback form submissions / week | Events → callback_form_submit | 3-5+ per week |
| Phone calls / week | Events → phone_call_click | Growing |
| Conversion rate (leads / sessions) | Conversions / Total sessions | Target: 3-5% |

### Traffic KPIs
| Metric | How to Find | Target |
|---|---|---|
| Organic sessions / week | Acquisition → Organic Search | Growing as pages get indexed |
| Area page sessions | Pages → filter to area pages | Growing within 4-8 weeks |
| Pricing page sessions | Pages → filter to cost pages | Growing |
| Average engagement time | Overview | > 1 minute |
| Pages per session | Overview | > 2 pages |

### Content Performance KPIs
| Metric | How to Find | Target |
|---|---|---|
| FAQ click rate | faq_click events / page views | Shows which questions matter |
| Scroll to 75%+ | scroll_depth 75% events / page views | > 30% of visitors |
| Time > 60s | time_on_page 60s events / page views | > 40% of visitors |

---

## Indian Market Best Practices

### GA4 Property Settings (Critical)
- **Time zone:** IST (GMT+5:30) — set this when creating the property, difficult to change later without data issues
- **Currency:** INR (Indian Rupee)
- **Link Google Search Console:** Admin → Search Console Links — essential for seeing which keywords drive organic traffic to area pages

### Mobile-First Analytics (75-85% of Indian traffic is mobile)
- Create a **"Mobile Users" comparison segment** in GA4 and use it as default in all explorations
- Key mobile metrics:
  - **Click-to-call rate** = `phone_call_click / mobile sessions` — mobile users tap phone numbers directly
  - **WhatsApp click rate by device** — should be very high on mobile (WhatsApp app opens directly)
  - **Page load time** — check Core Web Vitals in Search Console; Indian 4G can be variable, slow pages kill conversions
  - **Scroll depth on mobile** — shorter screens mean fewer users reach bottom CTAs; sticky CTA bar compensates

### WhatsApp as Primary Lead Channel
- WhatsApp is the #1 lead channel for Indian service businesses — track `whatsapp_click` as your primary key event
- The `event_label` (location) dimension is critical: compare `sticky_cta_bar` vs `hero_cta` vs `floating_button` performance
- Track `page_name` on WhatsApp clicks to see which content pages drive the most inquiries
- **Target:** Area landing pages should convert at 3-5% (WhatsApp clicks / page views)

### CTA Location Performance (new tracking)
- **Sticky CTA bar** (`sticky_cta_bar`) — always visible on scroll, tracks both WhatsApp and Call clicks
- **Floating button** (`floating_button`) — bottom-right WhatsApp icon
- **Hero CTA** (`hero_cta`) — above-the-fold call to action
- Compare these in GA4 → Explore → Rows: `event_label`, Filter: `whatsapp_click`
- This tells you which CTA placement drives the most leads

### Peak Traffic Hours (Bangalore Homeowners)
- **Weekday peaks:** 10 AM–1 PM IST (morning research) and 7 PM–10 PM IST (post-work browsing)
- **Weekend spikes:** Saturday-Sunday see higher traffic as couples research interiors together
- Schedule any paid campaigns around these windows
- Use GA4 → Reports → Realtime to monitor live traffic during peak hours

### Regional/Local SEO Tracking
- Use `page_type: area_landing` dimension to segment all area pages collectively
- Watch for organic traffic growth to area pages (Search Console data in GA4)
- Monitor referral traffic from Indian directories: Justdial, Sulekha, Urban Company, HomeLane
- Each area page (Sarjapur Road, Electronic City, HSR Layout, etc.) should be tracked independently via `page_name`

### Weekly Review Checklist
1. Total WhatsApp clicks this week vs last week (trending up?)
2. Which area pages getting organic traffic (Search Console)
3. Mobile conversion rate vs desktop
4. Top 3 FAQ questions clicked (content demand signals)
5. Sticky CTA bar vs floating button click share
6. Callback form submissions
7. Referral traffic from Indian directories
8. New project case study page views (are portfolio pages engaging?)

### Page Type Summary (for filtering)
| page_type | Pages | Purpose |
|---|---|---|
| `core_page` | homepage, services, portfolio, about, experience centre, our story | Main site pages |
| `area_landing` | electronic city, chandapura, bommasandra, sarjapur road, HSR layout, anantnagar, anekal | Local SEO landing pages |
| `pricing_guide` | modular kitchen cost, interior design cost | Pricing/cost comparison pages |
| `project_case_study` | abode 99, brigade valencia, mahendra aarya | Client project showcases |
