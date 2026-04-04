import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path("/Users/daehan/Documents/persona/paperclip/scripts/run_quality_gate_bundle.py")


class RunQualityGateBundleTests(unittest.TestCase):
    def test_writes_preflight_outputs_and_merged_result(self):
        with tempfile.TemporaryDirectory() as tmp:
            run_dir = Path(tmp)
            (run_dir / "draft.json").write_text(json.dumps({
                "title": "일반 사용자가 곧 체감할 3가지 변화",
                "sections": [{"title": "변화 1"}, {"title": "변화 2"}, {"title": "변화 3"}],
                "ending_judgment": "지금 써볼 사람과 기다릴 사람을 판단한다.",
                "markdown": "## 목차\n\nquick-scan\n\nwhat changed why it matters who should care\n\n이번 글에서 볼 3가지\n\n지금 써볼 사람과 기다릴 사람을 판단한다.",
            }))
            (run_dir / "research.json").write_text(json.dumps({
                "notebook_reference": "Fluxaivory AI-Tech Research",
                "fact_pack": {"items": [1]},
                "source_registry": [{"url": "https://example.com"}],
                "uncertainty_ledger": [{"claim": "x"}],
            }))
            (run_dir / "image.json").write_text(json.dumps({
                "featured": {"sha256": "a"},
                "support-1": {"sha256": "b", "role": "comparison"},
                "support-2": {"sha256": "c", "role": "workflow"},
            }))

            raw = subprocess.check_output(
                [sys.executable, str(SCRIPT), "--run-dir", str(run_dir), "--approved-topic", "일반 사용자가 곧 체감할 변화"],
                text=True,
            )
            result = json.loads(raw)
            self.assertTrue((run_dir / "preflight.publish_ready.json").exists())
            self.assertIn("publish_ready", result["results"])


if __name__ == "__main__":
    unittest.main()
