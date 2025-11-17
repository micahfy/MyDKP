#!/usr/bin/env python3
"""
DKP automation workflow script.

Steps:
1. Back up WebDKP.lua
2. Build CSV/API payload from WebDKP_Log entries
3. Log in and call the batch import endpoint
4. Export the latest WebDKP_DkpTable and write it back to WebDKP.lua

Dependencies: requests
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Sequence, Tuple

import requests

LogRow = Tuple[str, float, str, str, str]

LOG_SECTION_PATTERN = re.compile(r"WebDKP_Log\s*=\s*\{(.*?)\}\s*WebDKP_DkpTable", re.S)
# Require a single-tab indent before the closing brace so we don't stop at inner blocks
EVENT_PATTERN = re.compile(r'\["(.*?)"\]\s*=\s*\{(.*?)\n\t\},', re.S)
POINTS_PATTERN = re.compile(r'\["points"\]\s*=\s*([-\d\.]+)')
REASON_PATTERN = re.compile(r'\["reason"\]\s*=\s*"([^"]*)"')
DATE_PATTERN = re.compile(r'\["date"\]\s*=\s*"([^"]*)"')
AWARDED_PATTERN = re.compile(r'\["awarded"\]\s*=\s*\{(.*?)\n\t\t\},', re.S)
PLAYER_PATTERN = re.compile(r'\["([^"]+)"\]\s*=\s*\{')


@dataclass
class SiteConfig:
    base_url: str
    username: str
    password: str
    team_id: str | None
    ignore_duplicates: bool


@dataclass
class SelectedTeam:
    id: str
    name: str


@dataclass
class WorkflowConfig:
    webdkp_path: Path
    backup_dir: Path
    log_csv_path: Path
    export_output_path: Path
    clear_log_after_import: bool
    confirm_before_import: bool
    confirm_before_export: bool
    prompt_team_selection: bool
    site: SiteConfig


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="WebDKP automation pipeline")
    parser.add_argument(
        "--config",
        default="scripts/config.json",
        help="Path to config file (default: scripts/config.json)",
    )
    return parser.parse_args()


def load_config(path: Path) -> WorkflowConfig:
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")

    with path.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    base_dir = path.parent
    webdkp_path = _resolve_path(raw.get("webdkp_file"), base_dir, required_name="webdkp_file")
    backup_dir = _resolve_path(raw.get("backup_dir"), base_dir, required_name="backup_dir")

    log_csv_path = raw.get("log_csv_path")
    export_output_path = raw.get("export_output_path")

    if log_csv_path:
        log_csv = _resolve_path(log_csv_path, base_dir)
    else:
        log_csv = webdkp_path.with_name("log.csv")

    if export_output_path:
        export_output = _resolve_path(export_output_path, base_dir)
    else:
        export_output = webdkp_path.with_name("export.log")

    site_raw = raw.get("site") or {}
    for key in ("base_url", "username", "password"):
        if not site_raw.get(key):
            raise ValueError(f"Missing site.{key} value in config")

    base_url = site_raw["base_url"].rstrip("/")
    team_id = site_raw.get("team_id")
    site = SiteConfig(
        base_url=base_url,
        username=str(site_raw["username"]),
        password=str(site_raw["password"]),
        team_id=str(team_id) if team_id else None,
        ignore_duplicates=bool(site_raw.get("ignore_duplicates", True)),
    )

    return WorkflowConfig(
        webdkp_path=webdkp_path,
        backup_dir=backup_dir,
        log_csv_path=log_csv,
        export_output_path=export_output,
        clear_log_after_import=bool(raw.get("clear_log_after_import", True)),
        confirm_before_import=bool(raw.get("confirm_before_import", False)),
        confirm_before_export=bool(raw.get("confirm_before_export", False)),
        prompt_team_selection=bool(raw.get("prompt_team_selection", True)),
        site=site,
    )


def _resolve_path(value: str | None, base_dir: Path, required_name: str | None = None) -> Path:
    if not value:
        raise ValueError(f"Missing config value for {required_name}")
    candidate = Path(value).expanduser()
    if not candidate.is_absolute():
        candidate = (base_dir / candidate).resolve()
    return candidate


def backup_webdkp(webdkp_path: Path, backup_dir: Path) -> Path:
    if not webdkp_path.exists():
        raise FileNotFoundError(f"WebDKP.lua not found: {webdkp_path}")

    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"webdkp_{timestamp}.lua"
    backup_path = backup_dir / backup_name
    shutil.copy2(webdkp_path, backup_path)
    return backup_path


def extract_log_rows(webdkp_path: Path) -> List[LogRow]:
    text = webdkp_path.read_text(encoding="utf-8")
    match = LOG_SECTION_PATTERN.search(text)
    if not match:
        raise ValueError("Unable to locate WebDKP_Log block inside WebDKP.lua")

    log_body = match.group(1)
    rows: List[LogRow] = []

    for event_name, block in EVENT_PATTERN.findall(log_body):
        if event_name.strip().lower() == "version":
            continue

        points = _extract_float(block, POINTS_PATTERN)
        reason = _extract_string(block, REASON_PATTERN)
        date_str = _extract_string(block, DATE_PATTERN)
        date_part, time_part = _split_datetime(date_str)

        awarded_match = AWARDED_PATTERN.search(block)
        if not awarded_match:
            continue

        awarded_block = awarded_match.group(1)
        players = PLAYER_PATTERN.findall(awarded_block)
        for player in players:
            player_name = player.strip()
            if not player_name:
                continue
            rows.append((player_name, points, reason, date_part, time_part))

    return rows


def _extract_float(block: str, pattern: re.Pattern[str]) -> float:
    match = pattern.search(block)
    if not match:
        return 0.0
    try:
        return float(match.group(1))
    except ValueError:
        return 0.0


def _extract_string(block: str, pattern: re.Pattern[str]) -> str:
    match = pattern.search(block)
    if not match:
        return ""
    return match.group(1).strip()


def _split_datetime(raw: str) -> Tuple[str, str]:
    if not raw:
        return "", ""
    parts = raw.strip().split()
    if len(parts) == 2:
        return parts[0], parts[1]
    return raw.strip(), ""


def write_csv(rows: Sequence[LogRow], csv_path: Path) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        for row in rows:
            writer.writerow(row)


def login(session: requests.Session, site: SiteConfig) -> None:
    url = f"{site.base_url}/api/auth/login"
    resp = session.post(url, json={"username": site.username, "password": site.password})
    _raise_for_status(resp, "Login failed")


def import_logs(session: requests.Session, site: SiteConfig, rows: Sequence[LogRow], team_id: str) -> dict:
    payload = {
        "teamId": team_id,
        "importData": "\n".join(_format_import_line(row) for row in rows),
        "ignoreDuplicates": site.ignore_duplicates,
    }
    url = f"{site.base_url}/api/dkp/batch-import"
    resp = session.post(url, json=payload)
    _raise_for_status(resp, "DKP batch import failed")
    return resp.json()


def _format_import_line(row: LogRow) -> str:
    player, points, reason, date_part, time_part = row
    points_str = _format_points(points)
    # date/time can be empty; API falls back to "now"
    parts = [player or "", points_str, reason or "", date_part or "", time_part or ""]
    return ",".join(part.strip() for part in parts)


def _format_points(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return f"{value:.2f}".rstrip("0").rstrip(".")


def export_webdkp_table(session: requests.Session, site: SiteConfig) -> str:
    url = f"{site.base_url}/api/export/webdkp"
    resp = session.get(url)
    _raise_for_status(resp, "Failed to export latest WebDKP_DkpTable")
    return resp.text


def update_webdkp_file(
    webdkp_path: Path,
    new_table_text: str,
    clear_log: bool,
) -> None:
    content = webdkp_path.read_text(encoding="utf-8")

    if clear_log:
        log_replacement = "WebDKP_Log = {\n}\n"
        content = _replace_section(content, "WebDKP_Log", "WebDKP_DkpTable", log_replacement)

    trimmed_table = new_table_text.strip() + "\n"
    content = _replace_section(content, "WebDKP_DkpTable", "WebDKP_Tables", trimmed_table)
    webdkp_path.write_text(content, encoding="utf-8")


def _replace_section(content: str, start_token: str, end_token: str, replacement: str) -> str:
    start_index = content.find(start_token)
    if start_index == -1:
        raise ValueError(f"Unable to find section start: {start_token}")
    end_index = content.find(end_token, start_index + len(start_token))
    if end_index == -1:
        raise ValueError(f"Unable to find section end: {end_token}")
    before = content[:start_index]
    after = content[end_index:]
    replacement_block = replacement
    if not replacement_block.endswith("\n"):
        replacement_block += "\n"
    return before + replacement_block + after


def _raise_for_status(resp: requests.Response, fallback_message: str) -> None:
    try:
        resp.raise_for_status()
    except requests.HTTPError as exc:
        detail = _extract_error(resp)
        message = f"{fallback_message}: {detail}"
        raise RuntimeError(message) from exc


def wait_for_confirmation(message: str) -> None:
    while True:
        answer = input(f"{message} (y/N): ").strip().lower()
        if answer in ("y", "yes"):
            return
        if answer in ("n", "no", ""):
            raise RuntimeError("Workflow stopped by user before proceeding.")


def _extract_error(resp: requests.Response) -> str:
    try:
        data = resp.json()
        if isinstance(data, dict):
            return str(data.get("error") or data)
        return str(data)
    except ValueError:
        return resp.text.strip() or f"HTTP {resp.status_code}"


def fetch_teams(session: requests.Session, site: SiteConfig) -> List[dict]:
    url = f"{site.base_url}/api/teams/basic"
    resp = session.get(url)
    _raise_for_status(resp, "Failed to fetch team list")
    data = resp.json()
    if not isinstance(data, list):
        raise ValueError("Unexpected team list response")
    teams: List[dict] = []
    for item in data:
        team_id = str(item.get("id") or "").strip()
        name = str(item.get("name") or "").strip()
        if team_id and name:
            teams.append({"id": team_id, "name": name})
    return teams


def select_team(session: requests.Session, config: WorkflowConfig) -> SelectedTeam:
    if not config.prompt_team_selection:
        if config.site.team_id:
            return SelectedTeam(id=config.site.team_id, name=config.site.team_id)
        raise ValueError("prompt_team_selection is disabled but site.team_id is not provided")

    teams = fetch_teams(session, config.site)
    if not teams:
        raise ValueError("No teams available for selection")

    teams_sorted = sorted(teams, key=lambda item: item["name"].lower())
    print("Available teams:")
    for idx, info in enumerate(teams_sorted, start=1):
        print(f"   {idx}. {info['name']} ({info['id']})")

    while True:
        choice = input("Enter the number of the team to import into (or 'q' to abort): ").strip()
        if not choice:
            continue
        if choice.lower() in ("q", "quit"):
            raise RuntimeError("Workflow stopped because no team was selected.")
        if not choice.isdigit():
            print("Please enter a valid number.")
            continue
        index = int(choice)
        if not 1 <= index <= len(teams_sorted):
            print("Number out of range, please try again.")
            continue
        selected = teams_sorted[index - 1]
        confirm = input(
            f"Use team '{selected['name']}' (ID: {selected['id']}) for this import? (y/N): "
        ).strip().lower()
        if confirm in ("y", "yes"):
            return SelectedTeam(id=selected["id"], name=selected["name"])
        print("Selection canceled, please choose again.")


def run_workflow(config: WorkflowConfig) -> None:
    print(f"[1/5] Backing up WebDKP.lua -> {config.backup_dir}")
    backup_path = backup_webdkp(config.webdkp_path, config.backup_dir)
    print(f"      Backup stored at: {backup_path}")

    print("[2/5] Parsing WebDKP_Log and building import payload")
    rows = extract_log_rows(config.webdkp_path)
    print(f"      Extracted {len(rows)} log entries")
    write_csv(rows, config.log_csv_path)
    print(f"      CSV written to: {config.log_csv_path}")

    session = requests.Session()
    print("[3/5] Logging into DKP site")
    login(session, config.site)
    selected_team: SelectedTeam | None = None
    if rows:
        selected_team = select_team(session, config)
        print(f"      Target team: {selected_team.name} ({selected_team.id})")
        if config.confirm_before_import:
            wait_for_confirmation("Confirm CDN/cache is synchronized before importing DKP logs")
        print("[4/5] Importing log entries")
        result = import_logs(session, config.site, rows, selected_team.id)
        print(
            f"      Imported {result.get('success', 0)} ok, "
            f"{result.get('duplicate', 0)} duplicates, "
            f"{result.get('failed', 0)} failed"
        )
        errors = result.get("errors") or []
        if errors:
            print("      Sample errors:")
            for item in errors[:5]:
                line = item.get("line", "").strip()
                reason = item.get("error", "")
                print(f"        - {line or '[no line]'} -> {reason}")
            if len(errors) > 5:
                print(f"        ... ({len(errors) - 5} more)")
    else:
        print("      No log rows detected; skipping import step")

    print("[5/5] Exporting latest WebDKP_DkpTable")
    if config.confirm_before_export:
        wait_for_confirmation("Confirm CDN/cache is synchronized before exporting the DKP table")
    export_text = export_webdkp_table(session, config.site)
    config.export_output_path.write_text(export_text, encoding="utf-8")
    print(f"      Lua export saved to: {config.export_output_path}")

    print("      Updating WebDKP.lua with current DKP table")
    update_webdkp_file(config.webdkp_path, export_text, config.clear_log_after_import)
    print("      Lua file updated successfully")


def main() -> None:
    try:
        args = parse_args()
        config = load_config(Path(args.config))
        run_workflow(config)
    except Exception as exc:  # pylint: disable=broad-except
        print(f"[ERROR] {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
