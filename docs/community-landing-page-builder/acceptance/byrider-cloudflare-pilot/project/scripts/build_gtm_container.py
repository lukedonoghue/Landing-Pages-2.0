#!/usr/bin/env python3
"""Build an importable GTM web container for the funnel tracking contract."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path


ACCOUNT = "1234567890"
CONTAINER = "123456789"
FINGERPRINT = "1700000000000"
ALL_PAGES = "2147479553"


def parameter(key: str, value: str, kind: str = "TEMPLATE") -> dict:
    return {"type": kind, "key": key, "value": value}


def variable(identifier: int, name: str, kind: str, params: list[dict]) -> dict:
    return {"accountId": ACCOUNT, "containerId": CONTAINER, "variableId": str(identifier), "name": name, "type": kind, "parameter": params, "fingerprint": FINGERPRINT, "formatValue": {}}


def dlv(identifier: int, name: str, path: str) -> dict:
    return variable(identifier, name, "v", [parameter("dataLayerVersion", "2", "INTEGER"), parameter("setDefaultValue", "false", "BOOLEAN"), parameter("name", path)])


def trigger(identifier: int, name: str, event: str, hostname: str = "") -> dict:
    value = {"accountId": ACCOUNT, "containerId": CONTAINER, "triggerId": str(identifier), "name": name, "type": "CUSTOM_EVENT", "customEventFilter": [{"type": "EQUALS", "parameter": [parameter("arg0", "{{_event}}"), parameter("arg1", event)]}], "fingerprint": FINGERPRINT}
    if hostname:
        value["filter"] = [{"type": "EQUALS", "parameter": [parameter("arg0", "{{Page Hostname}}"), parameter("arg1", hostname)]}]
    return value


def page_trigger(identifier: int, hostname: str) -> dict:
    return {"accountId": ACCOUNT, "containerId": CONTAINER, "triggerId": str(identifier), "name": "Page View - Production Host", "type": "PAGEVIEW", "filter": [{"type": "EQUALS", "parameter": [parameter("arg0", "{{Page Hostname}}"), parameter("arg1", hostname)]}], "fingerprint": FINGERPRINT}


def tag(identifier: int, name: str, kind: str, params: list[dict], firing: str) -> dict:
    return {"accountId": ACCOUNT, "containerId": CONTAINER, "tagId": str(identifier), "name": name, "type": kind, "parameter": params, "fingerprint": FINGERPRINT, "firingTriggerId": [firing], "tagFiringOption": "ONCE_PER_EVENT", "monitoringMetadata": {"type": "MAP"}, "consentSettings": {"consentStatus": "NOT_SET"}}


def html_tag(identifier: int, name: str, html: str, firing: str) -> dict:
    return tag(identifier, name, "html", [parameter("html", html), parameter("supportDocumentWrite", "false", "BOOLEAN")], firing)


def validate(args: argparse.Namespace) -> None:
    if not re.fullmatch(r"GTM-[A-Z0-9]+", args.gtm_id):
        raise ValueError("--gtm-id must look like GTM-XXXXXXX")
    if not re.fullmatch(r"\d+", args.google_ads_id):
        raise ValueError("--google-ads-id must contain digits only, without AW-")
    if not re.fullmatch(r"[A-Za-z0-9_-]+", args.google_ads_label):
        raise ValueError("--google-ads-label contains unsupported characters")
    if args.hostname and not re.fullmatch(r"[A-Za-z0-9.-]+", args.hostname):
        raise ValueError("--hostname must be a hostname without scheme or path")
    if args.meta_pixel_id and not re.fullmatch(r"\d+", args.meta_pixel_id):
        raise ValueError("--meta-pixel-id must contain digits only")
    if args.microsoft_uet_id and not re.fullmatch(r"\d+", args.microsoft_uet_id):
        raise ValueError("--microsoft-uet-id must contain digits only")
    if args.enhanced_conversions and args.sensitive_category:
        raise ValueError("Enhanced customer data is blocked for sensitive-category funnels")


def build(args: argparse.Namespace) -> dict:
    variables = [
        variable(1, "Const - Google Ads Conversion ID", "c", [parameter("value", args.google_ads_id)]),
        dlv(2, "DLV - receipt_id", "receipt_id"),
    ]
    triggers = [trigger(10, "Custom Event - lead_accepted", "lead_accepted", args.hostname)]
    base_trigger = ALL_PAGES
    if args.hostname:
        triggers.append(page_trigger(12, args.hostname)); base_trigger = "12"
    tags = [
        tag(20, "Google Tag - Google Ads", "googtag", [parameter("tagId", f"AW-{args.google_ads_id}")], base_trigger),
        tag(21, "Conversion Linker", "gclidw", [parameter("enableCrossDomain", "false", "BOOLEAN"), parameter("enableUrlPassthrough", "false", "BOOLEAN"), parameter("enableCookieOverrides", "false", "BOOLEAN")], base_trigger),
        tag(22, f"Google Ads - {args.action_name}", "awct", [parameter("enableConversionLinker", "true", "BOOLEAN"), parameter("conversionId", "{{Const - Google Ads Conversion ID}}"), parameter("conversionLabel", args.google_ads_label), parameter("conversionValue", str(args.conversion_value)), parameter("currencyCode", args.currency), parameter("orderId", "{{DLV - receipt_id}}"), parameter("enableEnhancedConversion", "false", "BOOLEAN")], "10"),
    ]
    next_variable, next_tag = 3, 23
    customer_trigger_needed = args.enhanced_conversions or (not args.sensitive_category and (bool(args.meta_pixel_id) or bool(args.microsoft_uet_id)))
    if customer_trigger_needed:
        triggers.append(trigger(11, "Custom Event - customer_data_ready", "customer_data_ready", args.hostname))
    if args.enhanced_conversions:
        variables.extend([
            dlv(next_variable, "DLV - customer_data.google.sha256_email_address", "customer_data.google.sha256_email_address"),
            dlv(next_variable + 1, "DLV - customer_data.google.sha256_phone_number", "customer_data.google.sha256_phone_number"),
            variable(next_variable + 2, "JS - Google Hashed User Data", "jsm", [parameter("javascript", "function(){var e={{DLV - customer_data.google.sha256_email_address}},p={{DLV - customer_data.google.sha256_phone_number}},d={};if(e)d.sha256_email_address=e;if(p)d.sha256_phone_number=p;return d;}")]),
        ])
        tags.append(tag(next_tag, f"Google Ads - {args.action_name} - UPD(email, manual)", "awud", [parameter("enableConversionLinker", "true", "BOOLEAN"), parameter("conversionId", "{{Const - Google Ads Conversion ID}}"), parameter("userDataVariable", "{{JS - Google Hashed User Data}}")], "11"))
        next_variable += 3; next_tag += 1
    if args.meta_pixel_id:
        meta_tags = [
            html_tag(next_tag, "Meta Pixel - Base", f"<script>!function(f,b,e,v,n,t,s){{if(f.fbq)return;n=f.fbq=function(){{n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)}};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','{args.meta_pixel_id}');fbq('track','PageView');</script>", base_trigger),
            html_tag(next_tag + 1, "Meta Pixel - Lead", "<script>if(window.fbq)fbq('track','Lead',{}, {eventID:'{{DLV - receipt_id}}'});</script>", "10"),
        ]
        if not args.sensitive_category:
            variables.extend([dlv(next_variable, "DLV - customer_data.meta.em", "customer_data.meta.em"), dlv(next_variable + 1, "DLV - customer_data.meta.ph", "customer_data.meta.ph")])
            meta_tags.insert(1, html_tag(next_tag + 2, "Meta Pixel - Hashed Customer Data", f"<script>(function(){{if(!window.fbq)return;var e='{{{{DLV - customer_data.meta.em}}}}',p='{{{{DLV - customer_data.meta.ph}}}}',d={{}};if(e)d.em=e;if(p)d.ph=p;fbq('init','{args.meta_pixel_id}',d);}})();</script>", "11"))
            next_variable += 2; next_tag += 3
        else:
            next_tag += 2
        tags.extend(meta_tags)
    if args.microsoft_uet_id:
        microsoft_tags = [
            html_tag(next_tag, "Microsoft UET - Base", f"<script>(function(w,d,t,r,u){{var f,n,i;w[u]=w[u]||[];f=function(){{var o={{ti:'{args.microsoft_uet_id}',enableAutoSpaTracking:true}};o.q=w[u];w[u]=new UET(o);w[u].push('pageLoad')}};n=d.createElement(t);n.src=r;n.async=1;n.onload=n.onreadystatechange=function(){{var s=this.readyState;s&&s!=='loaded'&&s!=='complete'||(f(),n.onload=n.onreadystatechange=null)}};i=d.getElementsByTagName(t)[0];i.parentNode.insertBefore(n,i)}})(window,document,'script','//bat.bing.com/bat.js','uetq');</script>", base_trigger),
            html_tag(next_tag + 1, "Microsoft UET - Lead", "<script>window.uetq=window.uetq||[];window.uetq.push('event','submit_lead_form',{event_id:'{{DLV - receipt_id}}'});</script>", "10"),
        ]
        if not args.sensitive_category:
            variables.extend([dlv(next_variable, "DLV - customer_data.microsoft.em", "customer_data.microsoft.em"), dlv(next_variable + 1, "DLV - customer_data.microsoft.ph", "customer_data.microsoft.ph")])
            microsoft_tags.insert(1, html_tag(next_tag + 2, "Microsoft UET - Hashed Customer Data", "<script>(function(){window.uetq=window.uetq||[];var e='{{DLV - customer_data.microsoft.em}}',p='{{DLV - customer_data.microsoft.ph}}',d={};if(e)d.em=e;if(p)d.ph=p;window.uetq.push('set',{pid:d});})();</script>", "11"))
        tags.extend(microsoft_tags)
    version = {"path": f"accounts/{ACCOUNT}/containers/{CONTAINER}/versions/0", "accountId": ACCOUNT, "containerId": CONTAINER, "containerVersionId": "0", "container": {"path": f"accounts/{ACCOUNT}/containers/{CONTAINER}", "accountId": ACCOUNT, "containerId": CONTAINER, "name": args.client_name, "publicId": args.gtm_id, "usageContext": ["WEB"], "fingerprint": FINGERPRINT, "tagManagerUrl": f"https://tagmanager.google.com/#/container/accounts/{ACCOUNT}/containers/{CONTAINER}/workspaces?apiLink=container", "features": {"supportUserPermissions": True, "supportEnvironments": True, "supportWorkspaces": True, "supportGtagConfigs": True, "supportBuiltInVariables": True, "supportClients": True, "supportFolders": True, "supportTags": True, "supportTemplates": True, "supportTriggers": True, "supportVariables": True, "supportVersions": True, "supportZones": True}, "tagIds": [args.gtm_id]}, "variable": variables, "trigger": triggers, "tag": tags, "builtInVariable": [{"accountId": ACCOUNT, "containerId": CONTAINER, "type": kind, "name": name} for kind, name in [("PAGE_URL", "Page URL"), ("PAGE_PATH", "Page Path"), ("PAGE_HOSTNAME", "Page Hostname"), ("REFERRER", "Referrer"), ("EVENT", "Event")]], "fingerprint": FINGERPRINT}
    return {"exportFormatVersion": 2, "exportTime": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"), "containerVersion": version}


def verify(document: dict) -> None:
    version = document["containerVersion"]
    names = {item["name"] for item in version["variable"]}
    encoded = json.dumps(document)
    refs = set(re.findall(r"\{\{([^}]+)\}\}", encoded)) - {"_event", "Page Hostname"}
    missing = refs - names
    if missing:
        raise ValueError("Undefined GTM variables: " + ", ".join(sorted(missing)))
    if re.search(r'"(?:email|phone|user_email|user_phone)"\s*:', encoded, re.I):
        raise ValueError("Raw contact-data key found in generated container")
    events = {item["customEventFilter"][0]["parameter"][1]["value"] for item in version["trigger"] if item["type"] == "CUSTOM_EVENT"}
    if "lead_accepted" not in events:
        raise ValueError("lead_accepted trigger is missing")
    for item in version["tag"]:
        if item["type"] not in {"googtag", "gclidw", "awct", "awud", "html"}:
            raise ValueError(f"Unsupported tag type: {item['type']}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gtm-id", required=True)
    parser.add_argument("--google-ads-id", required=True)
    parser.add_argument("--google-ads-label", required=True)
    parser.add_argument("--action-name", default="Submit Lead Form")
    parser.add_argument("--client-name", default="Lead funnel")
    parser.add_argument("--hostname", default="")
    parser.add_argument("--currency", default="USD")
    parser.add_argument("--conversion-value", type=float, default=1.0)
    parser.add_argument("--enhanced-conversions", action="store_true")
    parser.add_argument("--sensitive-category", action="store_true")
    parser.add_argument("--meta-pixel-id", default="")
    parser.add_argument("--microsoft-uet-id", default="")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    validate(args)
    document = build(args)
    verify(document)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(document, indent=2) + "\n", encoding="ascii")
    print(f"Wrote validated GTM import: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
