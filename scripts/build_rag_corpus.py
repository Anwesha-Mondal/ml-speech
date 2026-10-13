"""Extract the RAG knowledge corpus from megaev.md into versioned JSON (Phase M2).

    python scripts/build_rag_corpus.py            # writes backend/rag/corpus/*.json

Sources in megaev.md:
  §17  interview question banks (21 industries) and §43 specialist cards
  §18  broadcast wire scripts (only 18.1-18.5; 18.6-18.25 are one filler text repeated) + §41.3
  §19  debate motions + §41.4 Lincoln-Douglas resolution
  §20  storytelling scripts + §41.5 noir monologue
The output is deterministic (sorted keys, stable order), so re-running gives identical files.
Deliberately not extracted: §3.3 and §28-§28.2/§44 speech texts with unclear or protected rights
(King, Jobs, Churchill); only passages with a rights manifest may be references (AGENTS.md).
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "megaev.md"
OUT = ROOT / "backend" / "rag" / "corpus"

# §4.2 role taxonomy, mapped onto the §17 industry IDs (education has no §4.2 entry).
ROLES: dict[str, list[str]] = {
    "software_engineering": ["Full-Stack Engineer", "Distributed Systems Architect", "Site Reliability Engineer", "Frontend Engineer"],
    "ai_data_science": ["ML Engineer", "AI Research Scientist", "Data Analyst", "MLOps Specialist"],
    "product_management": ["Associate PM", "Senior Product Manager", "Group PM", "Head of Product"],
    "investment_banking": ["M&A Analyst", "Leveraged Finance Associate", "Equity Research Analyst"],
    "healthcare_medicine": ["Resident Physician", "Nurse Practitioner", "Clinical Trial Coordinator"],
    "management_consulting": ["Strategy Consultant", "Engagement Manager", "Case Team Leader"],
    "law_legal_counsel": ["Corporate Litigation Associate", "Commercial Contracts Counsel", "Compliance Officer"],
    "cybersecurity_infosec": ["SOC Analyst", "Penetration Tester", "Chief Information Security Officer"],
    "b2b_sales_executive": ["Sales Development Rep", "Account Executive", "Enterprise Sales Director"],
    "marketing_brand_growth": ["Performance Marketing Lead", "Brand Strategist", "Product Marketing Manager"],
    "ui_ux_design_research": ["Product Designer", "UX Researcher", "Design Systems Lead"],
    "human_resources_people_ops": ["Talent Acquisition Lead", "HR Business Partner", "People Ops Director"],
    "supply_chain_logistics": ["Global Logistics Manager", "Supply Chain Analyst", "Plant Operations Lead"],
    "fintech_quant_risk": ["AML Officer", "Fraud Risk Specialist", "Quant Risk Manager"],
    "aerospace_hardware": ["Mechanical Design Engineer", "Avionics Specialist", "Propulsion Engineer"],
    "broadcast_journalism_pr": ["Investigative Reporter", "PR Director", "Crisis Communications Lead"],
    "public_policy_civic": ["Legislative Aide", "Policy Analyst", "Regulatory Affairs Specialist"],
    "nonprofit_social_impact": ["Grant Writer", "Development Director", "Executive Director"],
    "executive_c_suite": ["Chief Executive Officer", "Chief Technology Officer", "Chief Financial Officer"],
    "private_equity_vc": ["Investment Associate", "Principal", "Growth Equity Investor"],
    "education_edtech": ["Teacher", "Instructional Designer", "EdTech Product Lead"],
    "quant_trading": ["Quantitative Researcher", "HFT Portfolio Manager"],
    "semiconductor_vlsi": ["ASIC Verification Engineer", "Silicon Design Architect"],
    "smart_contract_security": ["Web3 Protocol Engineer", "Smart Contract Auditor"],
}

TAG = re.compile(r"\[(?:PAUSE [\d.]+s|VOICE: [^\]]+|CLIMAX|EMPHASIS)\]\s*")
LATEX = re.compile(r"\$([^$]+)\$")


GREEK = {"kappa": "κ", "theta": "θ", "xi": "ξ", "alpha": "α", "beta": "β", "sigma": "σ", "lambda": "λ"}
SYMBOLS = {"le": "≤", "ge": "≥", "cdot": "·", "times": "×"}


def _latex(expr: str) -> str:
    """Render the few LaTeX constructs megaev.md uses as plain readable text."""
    expr = re.sub(r"\\text\{([^}]*)\}", r"\1", expr)
    expr = re.sub(r"\\sqrt\{([^}]*)\}", r"√(\1)", expr)
    expr = re.sub(r"_\{([^}]*)\}", r"_\1", expr)
    expr = re.sub(r"\\([a-zA-Z]+)", lambda m: GREEK.get(m[1]) or SYMBOLS.get(m[1]) or "", expr)
    return re.sub(r"\s{2,}", " ", expr.replace("{", "").replace("}", ""))


def _clean(text: str) -> str:
    """Strip markdown emphasis and simple LaTeX so the text reads naturally."""
    text = LATEX.sub(lambda m: _latex(m.group(1)), text)
    return re.sub(r"\*+([^*]+)\*+", r"\1", text).strip()


def spoken(text: str) -> str:
    """Teleprompter copy without cue tags (what the speaker actually says)."""
    return re.sub(r"\s{2,}", " ", TAG.sub("", text)).strip()


def _section(lines: list[str], start: str, end: str) -> list[str]:
    i = next(k for k, line in enumerate(lines) if line.startswith(start))
    j = next(k for k, line in enumerate(lines) if k > i and line.startswith(end))
    return lines[i:j]


def _quoted(line: str) -> str:
    m = re.search(r'"(.+)"', line)
    return m.group(1) if m else line


# ---------- §17 + §43 interview ----------
def interview(lines: list[str]) -> list[dict[str, Any]]:
    docs: list[dict[str, Any]] = []
    sec = _section(lines, "## 17.", "## 18.")
    ind: dict[str, Any] = {}
    q: dict[str, Any] | None = None

    def flush() -> None:
        if q:
            docs.append(_interview_doc(ind, q))

    for line in sec:
        m = re.match(r"### 17\.\d+ Industry: (.+?) \(`(\w+)`\)", line)
        if m:
            flush()
            q = None
            ind = {"name": m[1], "id": m[2]}
            continue
        if line.startswith("- **Domain Scope:**"):
            ind["scope"] = _clean(line.split(":**", 1)[1])
        elif line.startswith("- **Core Competencies:**"):
            ind["competencies"] = [c.strip() for c in line.split(":**", 1)[1].split(",")]
        m = re.match(r"#### Question 17\.\d+\.(\d+): (.+)", line)
        if m:
            flush()
            q = {"n": int(m[1]), "type": m[2].strip(), "probes": []}
            continue
        if q is None:
            continue
        if line.startswith("> **Prompt:**"):
            q["prompt"] = _quoted(line)
        elif line.startswith("- **STAR Evaluation Criteria:**"):
            q["criteria"] = _clean(line.split(":**", 1)[1])
        elif line.startswith("- **Critical Keywords"):
            q["keywords"] = [k.strip() for k in line.split("`")[1].split(",") if k.strip()]
        elif line.strip().startswith("- *When Candidate Mentions"):
            t = re.search(r"`([^`]+)`", line)
            q["probes"].append({"trigger": t[1] if t else "", "question": _quoted(line.split(":*", 1)[1])})
        elif line.startswith("- **Exemplar Response Standard:**"):
            q["exemplar"] = _clean(line.split(":**", 1)[1])
    flush()

    # §43 specialist cards
    sec43 = _section(lines, "## 43.", "## 44.")
    sub_ids = {"43.1": "quant_trading", "43.2": "semiconductor_vlsi", "43.3": "smart_contract_security"}
    card: dict[str, Any] | None = None
    sub: dict[str, Any] = {}
    in_star = False

    def flush43() -> None:
        if card:
            docs.append(_interview_doc(sub, card))

    for line in sec43:
        m = re.match(r"### (43\.\d) Sub-Domain: (.+)", line)
        if m:
            flush43()
            card = None
            sub = {"id": sub_ids[m[1]], "name": m[2].strip(), "competencies": []}
            continue
        if line.startswith("- **Domain Focus:**"):
            sub["scope"] = _clean(line.split(":**", 1)[1])
        m = re.match(r"#### Card 43\.\d\.(\d): (.+)", line)
        if m:
            flush43()
            card = {"n": int(m[1]), "type": m[2].strip(), "probes": [], "criteria_parts": []}
            in_star = False
            continue
        if card is None:
            continue
        # Order matters: keyword and probe lines also start with "- *".
        if line.startswith("- **Question:**"):
            card["prompt"] = _quoted(line)
        elif line.startswith("- **STAR Technical Expectation:**"):
            in_star = True
        elif line.startswith("- **Critical Keywords:**"):
            in_star = False
            card["keywords"] = re.findall(r"`([^`]+)`", line)
        elif line.strip().startswith("- *Candidate mentions"):
            t = re.search(r"`([^`]+)`", line)
            card["probes"].append({"trigger": t[1] if t else "", "question": _clean(_quoted(line.split(":*", 1)[1]))})
        elif line.startswith("- **Model Answer Summary:**"):
            card["exemplar"] = _clean(line.split(":**", 1)[1])
        elif in_star and line.strip().startswith("- *"):
            card["criteria_parts"].append(_clean(line.strip()[2:]))
    flush43()
    return docs


def _interview_doc(ind: dict[str, Any], q: dict[str, Any]) -> dict[str, Any]:
    criteria = q.get("criteria") or " ".join(q.get("criteria_parts", []))
    keywords = q.get("keywords", [])
    return {
        "document_id": f"int_{ind['id']}_{q['n']:02d}",
        "domain": "interviewer",
        "title": f"{ind['name']}: {q['type']}",
        "content": " ".join([q["prompt"], criteria, " ".join(keywords)]),
        "metadata": {
            "industry": ind["id"],
            "industry_name": ind["name"],
            "industry_scope": ind.get("scope", ""),
            "roles": ROLES.get(ind["id"], []),
            "question_type": q["type"],
            "question": q["prompt"],
            "star_criteria": criteria,
            "keywords": keywords,
            "probes": q["probes"],
            "exemplar": q.get("exemplar", ""),
        },
    }


# ---------- §18 + §41.3 newsroom ----------
def newsroom(lines: list[str]) -> list[dict[str, Any]]:
    docs: list[dict[str, Any]] = []
    sec = _section(lines, "## 18.", "## 19.")
    cur: dict[str, Any] | None = None
    for line in sec:
        m = re.match(r"### 18\.(\d+) Script: (.+?) \(`(\w+)`\)", line)
        if m:
            if cur:
                docs.append(_news_doc(cur))
            cur = None if int(m[1]) > 5 else {"id": m[3], "title": m[2]}
            continue
        if cur is None:
            continue
        if line.startswith("- **Broadcast Category:**"):
            cur["category"] = line.split(":**", 1)[1].strip()
        elif line.startswith("- **Target Cadence:**"):
            cur["wpm"] = int(re.search(r"(\d+) Words", line)[1])  # type: ignore[index]
            cur["duration"] = float(re.search(r"Duration:\*\* ([\d.]+)", line)[1])  # type: ignore[index]
        elif line.startswith("- **Phonetic Pronunciation Guide:**"):
            cur["phonetics"] = [{"word": w, "say": s} for w, s in re.findall(r"\*\*(.+?)\*\* \((.+?)\)", line.split(":**", 1)[1])]
        elif line.startswith('> "'):
            cur["text"] = _quoted(line)
        elif line.startswith("- **Injected Breaking News Alert:**"):
            cur["alert"] = line.split("`")[1]
    if cur:
        docs.append(_news_doc(cur))

    # §41.3 hurricane rehearsal
    sec41 = _section(lines, "### 41.3", "### 41.4")
    text = next(_quoted(x) for x in sec41 if x.startswith('> "Good evening'))
    alert = next(_quoted(x) for x in sec41 if x.startswith('> "FLASH'))
    docs.append(
        _news_doc(
            {
                "id": "wire_weather_rehearsal",
                "title": "Emergency Hurricane Tracking (Rehearsal)",
                "category": "Severe Weather & Emergency Broadcasting",
                "wpm": 135,
                "duration": 60.0,
                "phonetics": [],
                "text": text,
                "alert": alert,
                "alert_at": 24.0,
            }
        )
    )
    return docs


def _news_doc(d: dict[str, Any]) -> dict[str, Any]:
    return {
        "document_id": d["id"],
        "domain": "newsroom",
        "title": d["title"],
        "content": spoken(d["text"]),
        "metadata": {
            "category": d["category"],
            "target_wpm": d["wpm"],
            "estimated_duration_sec": d["duration"],
            "phonetics": d["phonetics"],
            "teleprompter_text": d["text"],
            # Mid-read unless the spec gives a time.
            "breaking_alert": {"trigger_at_second": d.get("alert_at", round(d["duration"] / 2, 1)), "flash_text": d["alert"]},
        },
    }


# ---------- §19 + §41.4 debate ----------
def debate(lines: list[str]) -> list[dict[str, Any]]:
    docs: list[dict[str, Any]] = []
    sec = _section(lines, "## 19.", "### 19.99")
    cur: dict[str, Any] | None = None
    fields = {
        "- **Affirmative Constructive Stance:**": "affirmative",
        "- **Negative Rebuttal Counter-Attack:**": "negative",
        "- **Cross-Examination Trap Question:**": "trap",
        "- **Simulated Point of Information (POI):**": "poi",
    }
    for line in sec:
        m = re.match(r"### 19\.\d+ Debate Motion: (.+?) \(`(\w+)`\)", line)
        if m:
            if cur:
                docs.append(_debate_doc(cur))
            cur = {"id": m[2], "title": m[1]}
            continue
        if cur is None:
            continue
        if line.startswith("> **Motion:**"):
            cur["motion"] = _clean(_quoted(line))
        for prefix, key in fields.items():
            if line.startswith(prefix):
                val = line.split(":**", 1)[1].strip()
                cur[key] = _quoted(val) if key in ("trap", "poi") else val
    if cur:
        docs.append(_debate_doc(cur))

    sec41 = _section(lines, "### 41.4", "### 41.5")
    res = next(_quoted(x) for x in sec41 if x.startswith("- **Resolution:**"))
    aff = next(_quoted(x) for x in sec41 if x.startswith("- **Affirmative Constructive Claim"))
    neg = next(_quoted(x) for x in sec41 if x.startswith("- **Negative Rebuttal Sparring Counter"))
    docs.append(
        _debate_doc(
            {
                "id": "motion_ld_autonomous_weapons",
                "title": "Autonomous Weapons Treaty (Lincoln-Douglas)",
                "motion": res,
                "affirmative": aff,
                "negative": neg,
                "trap": "Who verifies a treaty against states that refuse inspection, and what happens to compliant states in the meantime?",
                "poi": "Point of Information! Human operators can be prosecuted for war crimes. Who stands trial when an algorithm misidentifies a target?",
                "format": "lincoln_douglas",
            }
        )
    )
    return docs


def _debate_doc(d: dict[str, Any]) -> dict[str, Any]:
    return {
        "document_id": d["id"],
        "domain": "debate",
        "title": d["title"],
        "content": " ".join([d["motion"], d["affirmative"], d["negative"]]),
        "metadata": {
            "motion": d["motion"],
            "format": d.get("format", "parliamentary"),
            "affirmative": d["affirmative"],
            "negative": d["negative"],
            "cross_examination_trap": d["trap"],
            "point_of_information": d["poi"],
        },
    }


# ---------- §20 + §41.5 storytelling ----------
def storytelling(lines: list[str]) -> list[dict[str, Any]]:
    docs: list[dict[str, Any]] = []
    sec = _section(lines, "## 20.", "## 21.")
    cur: dict[str, Any] | None = None
    for line in sec:
        m = re.match(r"### 20\.\d+ Narrative Script: (.+?) \(`(\w+)`\)", line)
        if m:
            if cur:
                docs.append(_story_doc(cur))
            cur = {"id": m[2], "title": m[1], "characters": []}
            continue
        if cur is None:
            continue
        if line.startswith("- **Creative Format:**"):
            fmt, genre = line.split("|")
            cur["format"] = fmt.split(":**", 1)[1].strip()
            cur["genre"] = genre.split(":**", 1)[1].strip()
        elif line.startswith("- **Target Dynamic Pitch Range:**"):
            cur["pitch_range"] = float(re.search(r"\\ge ([\d.]+)", line)[1])  # type: ignore[index]
            cur["climax_at"] = float(re.search(r"Second ([\d.]+)", line)[1])  # type: ignore[index]
        elif re.match(r"\s+- \*\*(.+?):\*\* \$F_0\$", line):
            name = re.search(r"\*\*(.+?):\*\*", line)[1]  # type: ignore[index]
            shift = float(re.search(r"`([+-][\d.]+) st`", line)[1])  # type: ignore[index]
            desc = line.split("|")[-1].strip().strip("*")
            cur["characters"].append({"name": name, "semitone_shift": shift, "description": desc})
        elif line.startswith('> "'):
            cur["text"] = _quoted(line)
    if cur:
        docs.append(_story_doc(cur))

    sec41 = _section(lines, "### 41.5", "## 42.")
    text = next(_quoted(x) for x in sec41 if x.startswith('> "'))
    docs.append(
        _story_doc(
            {
                "id": "story_noir_05",
                "title": "Noir Detective Monologue",
                "format": "Audiobook Dramatic Reading",
                "genre": "Hardboiled 1940s Noir",
                "pitch_range": 9.0,
                "climax_at": 28.0,
                "characters": [
                    {"name": "Narrator", "semitone_shift": 0.0, "description": "Low, steady narration."},
                    {"name": "Femme Fatale", "semitone_shift": 8.2, "description": "Higher register."},
                    {"name": "Detective Vance", "semitone_shift": -8.5, "description": "Lower register."},
                ],
                "text": text,
            }
        )
    )
    return docs


def _story_doc(d: dict[str, Any]) -> dict[str, Any]:
    return {
        "document_id": d["id"],
        "domain": "storytelling",
        "title": d["title"],
        "content": spoken(d["text"]),
        "metadata": {
            "format": d["format"],
            "genre": d["genre"],
            "target_pitch_range_st": d["pitch_range"],
            "target_climax_sec": d["climax_at"],
            "characters": d["characters"],
            "script_text": d["text"],
        },
    }


def build(spec: Path = SPEC) -> dict[str, list[dict[str, Any]]]:
    lines = spec.read_text(encoding="utf-8").split("\n")
    return {
        "interviewer": interview(lines),
        "newsroom": newsroom(lines),
        "debate": debate(lines),
        "storytelling": storytelling(lines),
    }


def main() -> int:
    corpus = build()
    OUT.mkdir(parents=True, exist_ok=True)
    for domain, docs in corpus.items():
        ids = [d["document_id"] for d in docs]
        assert len(ids) == len(set(ids)), f"duplicate document_id in {domain}"
        (OUT / f"{domain}.json").write_text(json.dumps(docs, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
        print(f"{domain}: {len(docs)} documents")
    return 0


if __name__ == "__main__":
    sys.exit(main())
