"""Generate a SideStore/AltStore Classic source from public iOS release IPAs."""
import io
import json
import os
from pathlib import Path
import plistlib
import re
import time
import urllib.request
import zipfile

REPO = "erickolb/DangerRoom"
SITE = "https://erickolb.github.io/DangerRoom"
BUNDLE = "net.chateaulore.hardlight"
TAG = re.compile(r"ios-v(\d+)\.(\d+)\.(\d+)-build([1-9]\d*)")


def download(url):
    headers = {"User-Agent": "DangerRoom-SideStore-source"}
    if url.startswith("https://api.github.com/") and os.environ.get("GH_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["GH_TOKEN"]
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=45) as response:
                return response.read()
        except OSError:
            if attempt == 3:
                raise
            time.sleep(5)


def releases():
    result = []
    page = 1
    while True:
        batch = json.loads(download(f"https://api.github.com/repos/{REPO}/releases?per_page=100&page={page}"))
        result.extend(batch)
        if len(batch) < 100:
            return result
        page += 1


def make_source(items, fetch=download):
    candidates = []
    for release in items:
        match = TAG.fullmatch(release["tag_name"])
        if match and not release["draft"] and not release["prerelease"]:
            candidates.append((tuple(map(int, match.groups())), release))
    candidates.sort(key=lambda item: item[0], reverse=True)
    versions, privacy, seen = [], {}, set()
    for numbers, release in candidates:
        version = ".".join(map(str, numbers[:3]))
        # Classic sources use marketing versions. Keep the newest build of each.
        if version in seen:
            continue
        assets = [a for a in release["assets"] if a["name"] == "DangerRoom.ipa"]
        if len(assets) != 1:
            raise ValueError(f"{release['tag_name']}: expected one DangerRoom.ipa; publish after uploading assets")
        asset = assets[0]
        data = fetch(asset["browser_download_url"])
        if len(data) != asset["size"] or not data:
            raise ValueError("IPA size does not match release metadata")
        with zipfile.ZipFile(io.BytesIO(data)) as ipa:
            paths = [p for p in ipa.namelist() if re.fullmatch(r"Payload/[^/]+\.app/Info.plist", p)]
            if len(paths) != 1 or any(".appex/Info.plist" in p for p in ipa.namelist()):
                raise ValueError("Expected one app without extensions; review source permissions for new packaging")
            info = plistlib.loads(ipa.read(paths[0]))
        if (info["CFBundleIdentifier"], info["CFBundleShortVersionString"], str(info["CFBundleVersion"])) != (BUNDLE, version, str(numbers[3])):
            raise ValueError(f"{release['tag_name']}: IPA identity/version differs from release tag")
        privacy.update({k: v for k, v in info.items() if k.startswith("NS") and k.endswith("UsageDescription")})
        versions.append({
            "version": version,
            "date": release["published_at"],
            "localizedDescription": release.get("body") or release["name"],
            "downloadURL": asset["browser_download_url"],
            "size": len(data),
            "minOSVersion": info["MinimumOSVersion"],
        })
        seen.add(version)
    if not versions:
        raise ValueError("No published stable iOS IPAs found")
    app = {
        "name": "Hardlight", "bundleIdentifier": BUNDLE,
        "developerName": "Chateau Lore", "subtitle": "Your comics sidekick",
        "localizedDescription": "Connect to your DangerRoom comic collection and reading journal. Privately provisioned credentials are required. No app extensions.",
        "iconURL": SITE + "/mask.png", "tintColor": "E7001F",
        "versions": versions,
        "appPermissions": {"entitlements": [], "privacy": privacy},
    }
    # Compatibility with older source readers.
    latest = versions[0]
    app.update({"version": latest["version"], "versionDate": latest["date"],
                "versionDescription": latest["localizedDescription"],
                "downloadURL": latest["downloadURL"], "size": latest["size"]})
    return {"name": "Hardlight · Chateau Lore", "identifier": "net.chateaulore.hardlight.source",
            "sourceURL": SITE + "/sidestore.json", "website": SITE + "/",
            "iconURL": SITE + "/mask.png", "tintColor": "E7001F",
            "apps": [app], "news": []}


if __name__ == "__main__":
    source = make_source(releases())
    target = Path(__file__).resolve().parents[1] / "website" / "sidestore.json"
    target.write_text(json.dumps(source, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Generated {target.name}: {len(source['apps'][0]['versions'])} iOS versions, latest {source['apps'][0]['version']}")

