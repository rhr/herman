#!/usr/bin/env python3
"""
Attach full-quality HUH (Harvard University Herbaria) specimen images to
matching herman specimens.

Input is an HUH specimen report CSV (e.g. HUH_specimenreport.csv) with columns
catalognumbernumeric (barcode), collector, collectornumber.

Matching (a herman specimen may match several HUH barcodes, e.g. duplicate sheets):
  1. specimen.code of the form HUH<digits> -> that barcode
  2. collector number (normalized: lowercase alphanumerics, from either
     specimen.collector_number or specimen.code) equal to the HUH collectornumber,
     AND at least one shared collector name word (>= 3 letters)

For each match, the specimen's HUH record page
  https://kiki.huh.harvard.edu/databases/specimen_search.php?barcode=<n>
is fetched, each "Full Quality" image link is followed (it redirects to
s3.amazonaws.com/huhspecimenimages/JPG/<8-digit barcode>.jpg), and the image is
saved under UPLOAD_DIR/specimens/<id>/<uuid>.jpg with an Image row whose
filename is the S3 basename (e.g. 00237426.jpg). Images whose filename is
already attached to the specimen are skipped, so the script is safe to re-run.

Run this ON THE SERVER, from the backend directory, as the user that owns the
uploads directory:

    python3 import_huh_images.py HUH_specimenreport.csv --user-email you@example.org --dry-run
    python3 import_huh_images.py HUH_specimenreport.csv --user-email you@example.org --limit 1
    python3 import_huh_images.py HUH_specimenreport.csv --user-email you@example.org
"""
import argparse
import collections
import csv
import os
import re
import sys
import time
import uuid
from pathlib import Path

import requests
from sqlalchemy import text

from herman_utils import audited_session

BACKEND_DIR = Path(__file__).resolve().parent
KIKI = "https://kiki.huh.harvard.edu/databases/specimen_search.php?barcode={}"
FULL_RE = re.compile(r"href='([^']*image\.php\?id=\d+)'>Full Quality")
SAFE_NAME_RE = re.compile(r"[\w.-]+\.jpe?g", re.I)


def norm_num(n):
    return re.sub(r"[^0-9a-z]", "", (n or "").lower())


def name_words(c):
    return {w for w in re.findall(r"[^\W\d_]{3,}", (c or "").lower()) if w not in {"and"}}


def find_matches(csv_path, specimens):
    """Return list of (specimen_id, code, barcode)."""
    with open(csv_path, encoding="utf-8", errors="replace", newline="") as f:
        rows = list(csv.DictReader(f))
    by_bc = {int(r["catalognumbernumeric"]): r for r in rows if r["catalognumbernumeric"].isdigit()}
    by_num = collections.defaultdict(list)
    for r in by_bc.values():
        n = norm_num(r["collectornumber"])
        if n and n != "sn":
            by_num[n].append(r)

    matches = []
    for sid, code, collector, cnum in specimens:
        m = re.fullmatch(r"HUH0*(\d+)", code or "")
        if m and int(m.group(1)) in by_bc:
            matches.append((sid, code, int(m.group(1))))
            continue
        words = name_words(collector)
        found = set()
        for n in {norm_num(cnum), norm_num(code)} - {""}:
            for r in by_num.get(n, []):
                if words & name_words(r["collector"]):
                    found.add(int(r["catalognumbernumeric"]))
        matches.extend((sid, code, bc) for bc in sorted(found))
    return matches, len(rows)


def full_quality_links(session, barcode):
    html = session.get(KIKI.format(barcode), timeout=60).text
    return [u.replace("http://", "https://", 1) for u in FULL_RE.findall(html)]


def download(session, url, dest_dir, barcode):
    """Download url into dest_dir/<uuid>.jpg. Returns (source_name, path, size)."""
    for attempt in range(3):
        tmp = None
        try:
            with session.get(url, timeout=600, stream=True) as r:
                r.raise_for_status()
                name = os.path.basename(r.url.split("?")[0])
                if not SAFE_NAME_RE.fullmatch(name):
                    name = f"{barcode:08d}_{url.rsplit('=', 1)[1]}.jpg"
                expected = int(r.headers.get("Content-Length", -1))
                dest_dir.mkdir(parents=True, exist_ok=True)
                path = dest_dir / f"{uuid.uuid4()}.jpg"
                tmp = path.with_suffix(".part")
                size = 0
                with open(tmp, "wb") as out:
                    for chunk in r.iter_content(1 << 20):
                        out.write(chunk)
                        size += len(chunk)
            if expected >= 0 and size != expected:
                raise IOError(f"truncated download ({size} of {expected} bytes)")
            with open(tmp, "rb") as fh:
                if fh.read(3) != b"\xff\xd8\xff":
                    raise IOError("not a JPEG")
            os.replace(tmp, path)
            return name, path, size
        except Exception as e:
            if tmp and tmp.exists():
                tmp.unlink()
            if attempt == 2:
                raise
            print(f"    retry {attempt + 1} after error: {e}")
            time.sleep(10)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", help="HUH specimen report CSV")
    ap.add_argument("--user-email", required=True, help="herman user the changes are attributed to")
    ap.add_argument("--upload-dir", help="override UPLOAD_DIR (default: from backend .env, relative to backend dir)")
    ap.add_argument("--image-url", help="override API_IMAGE_URL used to build image URLs")
    ap.add_argument("--dry-run", action="store_true", help="list what would be attached; download nothing")
    ap.add_argument("--limit", type=int, help="stop after attaching this many images")
    args = ap.parse_args()

    with audited_session(user_email=args.user_email, dry_run=args.dry_run,
                         description="Import HUH specimen images") as db:
        # herman_utils has loaded backend/.env by now
        upload_dir = Path(args.upload_dir or os.getenv("UPLOAD_DIR", "./uploads"))
        if not upload_dir.is_absolute():
            upload_dir = (BACKEND_DIR / upload_dir).resolve()
        base_url = (args.image_url or os.getenv("API_IMAGE_URL", "")).rstrip("/")

        # Sanity checks against existing images: files must be where we think,
        # and URLs must be built the same way.
        sample = db.execute(text("SELECT storage_path, url FROM images ORDER BY id DESC LIMIT 20")).fetchall()
        present = sum((upload_dir / p).exists() for p, _ in sample)
        print(f"Upload dir: {upload_dir}  ({present}/{len(sample)} recent image files found there)")
        print(f"Image URL base: {base_url or '(unset)'}  (existing example: {sample[0][1] if sample else '-'})")
        problems = []
        if sample and present == 0:
            problems.append("none of the recent image files exist under the upload dir; use --upload-dir")
        if sample and not all(u == f"{base_url}/{p}" for p, u in sample):
            problems.append("existing image URLs are not <image-url>/<storage_path>; use --image-url")
        for msg in problems:
            print(("WARNING: " if args.dry_run else "ERROR: ") + msg)
        if problems and not args.dry_run:
            sys.exit(1)

        specimens = db.execute(text("SELECT id, code, collector, collector_number FROM specimens")).fetchall()
        matches, nrows = find_matches(args.csv, specimens)
        print(f"{nrows} CSV rows; {len({m[0] for m in matches})} specimens match "
              f"({len(matches)} specimen/barcode pairs)")

        attached_names = collections.defaultdict(set)
        for sid, fn in db.execute(text("SELECT specimen_id, filename FROM images")):
            attached_names[sid].add(fn)
        todo = [m for m in matches if f"{m[2]:08d}.jpg" not in attached_names[m[0]]]
        print(f"{len(matches) - len(todo)} already attached; {len(todo)} to process\n")

        if args.dry_run:
            for sid, code, bc in todo:
                print(f"would attach {bc:08d}.jpg -> specimen {sid} ({code})")
            return

        from models import Image  # importable after herman_utils set up the backend path

        http = requests.Session()
        http.headers["User-Agent"] = "herman-huh-image-import"
        stats = collections.Counter()
        for i, (sid, code, bc) in enumerate(todo, 1):
            if args.limit is not None and stats["attached"] >= args.limit:
                break
            print(f"[{i}/{len(todo)}] specimen {sid} ({code}) barcode {bc:08d}")
            try:
                links = full_quality_links(http, bc)
            except Exception as e:
                print(f"    ERROR fetching record page: {e}")
                stats["failed"] += 1
                continue
            if not links:
                print("    no Full Quality image on HUH record")
                stats["no_image"] += 1
                continue
            dest_dir = upload_dir / "specimens" / str(sid)
            for url in links:
                path = None
                try:
                    name, path, size = download(http, url, dest_dir, bc)
                    if name in attached_names[sid]:
                        path.unlink()
                        stats["already"] += 1
                        continue
                    storage_path = f"specimens/{sid}/{path.name}"
                    max_pos = db.execute(text("SELECT MAX(position) FROM images WHERE specimen_id=:s"),
                                         {"s": sid}).scalar()
                    db.add(Image(
                        specimen_id=sid,
                        filename=name,
                        storage_filename=path.name,
                        storage_path=storage_path,
                        url=f"{base_url}/{storage_path}",
                        mime_type="image/jpeg",
                        size_bytes=size,
                        position=0 if max_pos is None else max_pos + 1,
                    ))
                    db.commit()
                    attached_names[sid].add(name)
                    stats["attached"] += 1
                    print(f"    attached {name} ({size / 1e6:.1f} MB) -> {storage_path}")
                except Exception as e:
                    db.rollback()
                    if path is not None and path.exists():
                        path.unlink()
                    print(f"    ERROR: {e}")
                    stats["failed"] += 1

        print(f"\nattached={stats['attached']} already_present={stats['already']} "
              f"no_huh_image={stats['no_image']} failed={stats['failed']}")


if __name__ == "__main__":
    main()
