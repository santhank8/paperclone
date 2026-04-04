import json
import tempfile
import unittest
from pathlib import Path


import importlib.util

SPEC = importlib.util.spec_from_file_location(
    "grok_artifact_step",
    "/Users/daehan/Documents/persona/paperclip/scripts/grok_artifact_step.py",
)
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)  # type: ignore


class GrokArtifactStepTests(unittest.TestCase):
    def test_extract_marked_json_uses_last_marker(self):
        marker = "GROK_JSON_test"
        text = """
old stuff
<GROK_JSON_test>
{"a": 1}
</GROK_JSON_test>
noise
<GROK_JSON_test>
{"b": 2}
</GROK_JSON_test>
"""
        payload = mod.extract_marked_json(text, marker)
        self.assertEqual(payload, {"b": 2})

    def test_build_prompt_contains_marker(self):
        prompt, marker = mod.build_prompt("trend-scan", "MCP adoption", "Title")
        self.assertIn(marker, prompt)
        self.assertIn("public_narratives", prompt)


if __name__ == "__main__":
    unittest.main()
