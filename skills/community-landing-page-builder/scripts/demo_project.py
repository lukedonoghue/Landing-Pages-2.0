#!/usr/bin/env python3
"""Build deterministic, explicitly fictional local demo source from the real scaffold."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import html
import json
from pathlib import Path
import subprocess
import sys

SKILL = Path(__file__).resolve().parents[1]
MARKER = ".landing-pages-demo.json"


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def assert_demo(project):
    project = Path(project).expanduser().resolve()
    for name in ['.wrangler', '.secrets', 'build', 'public']:
        path = project / name
        if path.is_symlink() or not path.resolve().is_relative_to(project):
            raise ValueError('Demo runtime paths must stay inside the demo; no data was changed.')
    try:
        marker = json.loads((project / MARKER).read_text())
        funnel = json.loads((project / "funnel.json").read_text())
        config = json.loads((project / "wrangler.jsonc").read_text())
    except (OSError, ValueError) as error:
        raise ValueError("This is not an owned local demo; no data was changed.") from error
    if marker != {"schema_version": 1, "kind": "synthetic-local-demo"} or funnel.get("development_fixture") is not True:
        raise ValueError("Local demo identity is missing; no data was changed.")
    if config.get("account_id") or config.get("routes") or any(db.get("database_id") != "00000000-0000-0000-0000-000000000000" for db in config.get("d1_databases", [])):
        raise ValueError("This project contains a remote binding; demo operations are disabled.")
    if config.get("name") != "landing-pages-local-demo" or len(config.get("d1_databases", [])) != 1:
        raise ValueError("Demo Worker/database identity changed; no data was changed.")
    return project


def write_demo_sources(project):
    project = Path(project).expanduser().absolute()
    if project.is_symlink() or (project.exists() and any(project.iterdir())):
        raise ValueError("Choose a new or empty demo directory. Existing projects are never overwritten.")
    project = project.resolve()
    data = json.loads((SKILL / "assets/demo.json").read_text())
    result = subprocess.run([sys.executable, str(SKILL / "scripts/scaffold_project.py"), str(project),
                             "--client", data['name'], "--website", "https://example.invalid"],
                            capture_output=True, text=True)
    if result.returncode:
        raise ValueError("The demo scaffold could not be created.")
    write_json(project / MARKER, {"schema_version": 1, "kind": "synthetic-local-demo"})
    funnel = json.loads((project / "funnel.json").read_text())
    funnel.update(development_fixture=True, offer="Fictional project guide and conversation",
                  cta=data["cta"], follow_up_promise=data["follow_up"],
                  images={"enabled": False, "reason": "Deterministic local fixture uses its rendered PDF cover; no external or generated photos."})
    funnel["client"].update(name=data["name"], privacy_url="/privacy.html")
    for field in funnel["form_fields"]:
        if field["name"] == "service":
            field["options"] = data["services"]
    write_json(project / "funnel.json", funnel)
    config = json.loads((project / "wrangler.jsonc").read_text())
    config.update(name="landing-pages-local-demo", workers_dev=False)
    config["d1_databases"][0]["database_name"] = "landing-pages-local-demo-crm"
    write_json(project / "wrangler.jsonc", config)
    site = json.loads((project / "src/site-config.json").read_text())
    site.update(name=data["name"], timezone="UTC", formFields=funnel["form_fields"])
    write_json(project / "src/site-config.json", site)
    page_path = project / "public/index.html"
    page = page_path.read_text()
    page = page.replace("Make a confident plan for your next project.", html.escape(data["headline"]))
    page = page.replace("Tell us what you have in mind. We'll help you understand your options and choose the right next step.", html.escape(data["body"]))
    page = page.replace("Service one", data["services"][0]).replace("Service two", data["services"][1])
    page = page.replace("Replace this starter with your approved client content.", "Fictional local demonstration. Do not enter real customer information.")
    page = page.replace("<body>", '<body><aside class="demo-notice">Local demonstration · fictional business and data · publishing disabled</aside>')
    page = page.replace("<!-- Copy and adapt the fields only after the form schema is approved. -->",
                        '<section class="demo-guide"><img src="/assets/brochure/cover-600.webp" width="600" height="777" loading="lazy" alt="Cover of the fictional project guide"><div><h2>Your project guide</h2><p>Explore the complete page, form, PDF, CRM and reporting using fictional local data.</p></div></section>')
    page_path.write_text(page)
    thank_you = project / "public/thank-you.html"
    thank_you.write_text(thank_you.read_text().replace(
        "If you've submitted a request, our team will use the details you provided to follow up.",
        "Your fictional enquiry is saved in the local CRM. Download the guide below. "+html.escape(data['follow_up'])))
    privacy = project / "public/privacy.html"
    privacy.write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local demo privacy</title><link rel="stylesheet" href="/styles.css"><script src="/funnel.js" data-measure="false" defer></script><main class="support"><h1>Fictional local demo</h1><p>Use synthetic contact details only. This demo stores test enquiries and optional visitor measurements in a local database. No advertising provider or notification destination is configured.</p><p>This is not a privacy policy for a real business. Create a new client project and supply its actual policy before publishing.</p><a href="/">Back to the demonstration</a></main></html>')
    with (project / "public/styles.css").open("a") as output:
        output.write("\n.demo-notice{padding:10px 20px;text-align:center;background:#e1e9db;color:#203c32;font-size:13px}.demo-guide{max-width:900px;margin:0 auto 60px;padding:24px;display:flex;align-items:center;gap:38px}.demo-guide img{width:220px;height:auto;box-shadow:0 8px 28px #0002}h1,h2{text-wrap:balance}@media(max-width:600px){.demo-guide{flex-direction:column;align-items:flex-start}.demo-guide img{width:160px}}@media(max-width:340px){.demo-notice{padding:6px 12px}.hero{padding:28px 18px 24px}.hero h1{font-size:36px;margin:14px auto}.hero .intro{margin:16px auto 20px}}@media(min-width:601px) and (max-height:760px){header{padding-top:12px;padding-bottom:12px}.hero{padding:18px 24px 16px}.hero h1{font-size:clamp(44px,4.2vw,58px);margin:14px auto}.hero .intro{margin:16px auto 20px}.hero .micro{margin:12px auto}}\n")
    write_json(project / "test-fixture.json", data["fixture"])
    write_json(project / "build/demo-copy.json", data)
    steps = [{"title": "Share your project", "body": "Use fictional contact details in the demonstration form."},
             {"title": "Download the guide", "body": "Open this PDF after the local database accepts your enquiry."},
             {"title": "Explore the CRM", "body": "Sign in locally to see the saved contact, stages and reporting."}]
    catalogue = {
        "include_contents": False,
        "brand": {"name": data["name"], "footer": "FICTIONAL LOCAL DEMONSTRATION", "phone_display": "",
                  "phone_uri": "", "website": "", "contact_url": "",
                  "colors": {"primary": "#183D35", "secondary": "#245347", "accent": "#D4DDAB", "paper": "#F5F3E9"}},
        "cover": {"eyebrow": "FICTIONAL PROJECT GUIDE", "headline": "A clear start.\nA better plan.",
                  "body": data["body"], "label": "LOCAL DEMONSTRATION", "image": "", "image_mode": "none"},
        "proof_pillars": [], "services": [],
        "process": {"headline": "Explore the complete journey.", "summary": "This guide is a deterministic software test fixture, not an offer from a real company.", "image": "", "image_mode": "none", "steps": steps},
        "cta": {"eyebrow": "YOUR NEXT STEP", "headline": "Try the complete local journey.",
                "body": "Explore the page, submit a fictional enquiry, then find the same receipt in the CRM.",
                "action_label": data["cta"], "image": "", "image_mode": "none", "steps": steps,
                "follow_up_promise": data["follow_up"]}
    }
    write_json(project / "build/demo-catalogue.json", catalogue)
    # Authored synthetic contract, never scraped from output and never a user approval.
    master = {
        "h1": data['headline'], "primary_cta": data['cta'],
        "sections": [
            {"id": "hero", "headline": "A clearer start", "body": data['body'], "micro": "A useful guide. A conversation about your project."},
            {"id": "benefits", "headline": "Know what matters before you begin.",
             "body": "Explore your service options, see how the process works, and bring your questions to a conversation with our team.",
             "items": [{"number": "01", "headline": "Understand your options", "body": "Find the approach that fits what you want to achieve."},
                       {"number": "02", "headline": "Prepare for the process", "body": "Learn what information makes the first conversation useful."},
                       {"number": "03", "headline": "Choose your next step", "body": "Discuss your needs before making a commitment."}]},
            {"id": "guide", "headline": "Your project guide", "body": "Explore the complete page, form, PDF, CRM and reporting using fictional local data."}
        ],
        "modal": {"submit_label": data['cta'], "follow_up_promise": data['follow_up'],
                  "failure": "We could not accept your request. Check your details and try again.",
                  "uncertain": "We could not confirm whether your request was saved. Retry to check the same request safely; your details are kept unchanged."},
        "thank_you": {"eyebrow": "Your next step", "headline": "Here is your project guide.",
                      "body": "Your fictional enquiry is saved in the local CRM. Download the guide below.",
                      "follow_up_promise": data['follow_up'], "download_label": "Download your service guide",
                      "reader_heading": "Read your guide now"},
        "brochure": {"cover_promise": catalogue['cover']['headline'], "delivery": "Download after a fictional enquiry is saved.",
                     "text": [catalogue['cover']['eyebrow'], catalogue['cover']['headline'], data['body'], catalogue['cover']['label'],
                              catalogue['process']['headline'], catalogue['process']['summary'], "OUR PROCESS",
                              *[f"{i:02d} {s['title']} {s['body']}" for i,s in enumerate(steps,1)],
                              catalogue['cta']['eyebrow'], catalogue['cta']['headline'], catalogue['cta']['body'],
                              *[f"{i} {s['title']} {s['body']}" for i,s in enumerate(steps,1)],
                              data['cta'], data['follow_up'], catalogue['brand']['footer']]},
        "interface_text": ["Local demonstration · fictional business and data · publishing disabled",
                           "Fictional local demonstration. Do not enter real customer information."]
    }
    write_json(project / 'build/page-copy.json', master)
    (project / ".gitignore").write_text((project / ".gitignore").read_text() + "\n.landing-pages-demo.json\n")
    (project / "DEMO-README.md").write_text(
        "# Fictional local demonstration\n\nGenerated from the installed skill. Publishing and remote setup are disabled.\n"
        "Use synthetic data only. The three seed contacts and sample visits are fixture data, not proof of form delivery.\n"
        "The quickstart verify-demo command tests the actual browser form and D1-backed CRM separately.\n"
        "Login username: owner. The password is private in .secrets/local-admin-password.txt; never commit it.\n"
        "To start, use the skill's quickstart.py serve --project <this directory>.\n"
        "To reset, stop the server and use quickstart.py reset-demo. Old local state is preserved privately before reset.\n")
    (project / "START-HERE.md").write_text(
        "# Start here: fictional local demonstration\n\n"
        "This page, brochure, CRM and test database run only on your computer. No Cloudflare account is needed. "
        "This demonstration cannot be published through the supported setup/publishing helpers.\n\n"
        "Ask the agent to start this demo with the installed skill's quickstart.py serve --project <this directory>, "
        "then open the local page and team login. Use fictional details only. The login username is owner; "
        "the random password stays privately in .secrets/local-admin-password.txt.\n\n"
        "The quickstart verify-demo command exercises the actual local form and CRM. Stop the server before "
        "reset-demo; it preserves the previous local database privately. See DEMO-README.md for details.\n\n"
        "For your own published page, start a new client project from your website and follow its copy and final publication approvals.\n")
    assert_demo(project)
    return project


def seed_sql(today=None):
    """Known synthetic cohorts; this is fixture seeding, not delivery evidence."""
    today = today or datetime.now(timezone.utc).date()
    statements = []
    cohorts = [("google", "paid", "desktop", "new"), ("facebook", "paid", "mobile", "qualified"),
               ("google", "organic", "mobile", "follow_up")]
    for index, (source, traffic, device, status) in enumerate(cohorts):
        day = (today - timedelta(days=index + 1)).isoformat()
        visitor = f"demo-browser-{index}"
        event = f"demo-event-{index}"
        for visit_index in range(3):
            event_id = event if visit_index == 0 else f"{event}-{visit_index}"
            visitor_id = visitor if visit_index == 0 else f"{visitor}-{visit_index}"
            statements.append(f"INSERT OR IGNORE INTO visit_events(event_id,reporting_day,path,visitor_hash,created_at,payload_hash,device,traffic_source,traffic_type) VALUES('{event_id}','{day}','/','{visitor_id}','{day}T12:00:00Z','demo-seed','{device}','{source}','{traffic}');")
        lead = f"demo-lead-{index}"
        statements.append(f"INSERT OR IGNORE INTO leads(id,receipt_id,idempotency_key,payload_hash,created_at,updated_at,reporting_day,name,email,status,form_name,form_data,attribution,landing_page,visitor_hash,visit_event_id,device,traffic_source,traffic_type) VALUES('{lead}','demo-receipt-{index}','demo-key-{index}','demo-seed','{day}T12:00:00Z','{day}T12:00:00Z','{day}','Fictional Contact {index+1}','demo-{index+1}@example.invalid','{status}','enquiry','{{}}','{{}}','/','{visitor}','{event}','{device}','{source}','{traffic}');")
        statements.append(f"INSERT OR IGNORE INTO notes(id,lead_id,body,created_at) VALUES('demo-note-{index}','{lead}','Synthetic fixture contact for local exploration.','{day}T12:00:00Z');")
    return "\n".join(statements) + "\n"
