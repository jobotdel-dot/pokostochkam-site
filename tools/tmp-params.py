import json, os

path = os.path.join(r"C:\Users\jobot\.dsh\skills\buh-article", "data", "params.jsonl")
rows = [json.loads(l) for l in open(path, encoding="utf-8") if l.strip()]
for r in rows:
    print(
        "%-32s %-18s %-44s %s %s"
        % (
            str(r.get("id", "?"))[:32],
            str(r.get("value", ""))[:18],
            str(r.get("norm", ""))[:44],
            str(r.get("verified", ""))[:10],
            str(r.get("status", "")),
        )
    )
