import io
import plistlib
import unittest
import zipfile
from sidestore_source import BUNDLE, make_source


def fixture(version="0.3.0", build=1):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as ipa:
        ipa.writestr("Payload/Hardlight.app/Info.plist", plistlib.dumps({
            "CFBundleIdentifier": BUNDLE, "CFBundleShortVersionString": version,
            "CFBundleVersion": str(build), "MinimumOSVersion": "17.0",
            "NSCameraUsageDescription": "Take inventory photos.",
        }))
    data = output.getvalue()
    return {"tag_name": f"ios-v{version}-build{build}", "draft": False, "prerelease": False,
            "published_at": "2026-10-20T12:00:00Z", "name": "Hardlight", "body": "Release notes",
            "assets": [{"name": "DangerRoom.ipa", "size": len(data), "browser_download_url": f"https://example.com/{version}/{build}.ipa"}]}, data


class SourceTests(unittest.TestCase):
    def test_filters_platform_and_prereleases_sorts_numerically_and_deduplicates_builds(self):
        pairs = [fixture("0.3.0"), fixture("0.10.0"), fixture("0.3.0", 2)]
        downloads = {r["assets"][0]["browser_download_url"]: data for r, data in pairs}
        beta, _ = fixture("9.0.0")
        beta["prerelease"] = True
        android = {"tag_name": "v99.0.0", "draft": False, "prerelease": False}
        source = make_source([android, beta] + [r for r, _ in pairs], downloads.__getitem__)
        app = source["apps"][0]
        self.assertEqual([v["version"] for v in app["versions"]], ["0.10.0", "0.3.0"])
        self.assertTrue(app["versions"][1]["downloadURL"].endswith("/2.ipa"))
        self.assertEqual(app["version"], "0.10.0")
        self.assertEqual(app["appPermissions"]["privacy"], {"NSCameraUsageDescription": "Take inventory photos."})
        self.assertNotIn("marketplaceID", app)
        self.assertNotIn("buildVersion", app["versions"][0])

    def test_missing_asset_fails_instead_of_silently_publishing_old_version(self):
        release, _ = fixture()
        release["assets"] = []
        with self.assertRaisesRegex(ValueError, "expected one"):
            make_source([release])

    def test_tag_and_ipa_identity_must_match(self):
        release, data = fixture()
        release["tag_name"] = "ios-v0.4.0-build1"
        with self.assertRaisesRegex(ValueError, "identity/version"):
            make_source([release], lambda _: data)

    def test_wrong_asset_size_and_empty_catalog_fail(self):
        release, data = fixture()
        release["assets"][0]["size"] += 1
        with self.assertRaisesRegex(ValueError, "size"):
            make_source([release], lambda _: data)
        with self.assertRaisesRegex(ValueError, "No published"):
            make_source([])


if __name__ == "__main__":
    unittest.main()

