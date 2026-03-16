# Tools

## Paperclip Skill
Primary coordination tool. Use for all API calls to the Paperclip control plane.

## Brand Guide
**Read `content/brand-guide.md` before creating any visual asset.** It has the exact colors, font sizes, and hex values for the dark terminal aesthetic.

## The Video Pipeline (proven, working)

The full end-to-end flow, in order:

### Step 1 — Script
Receive a video script from TutorialWriter. The script should be formatted as a TTS-ready text file:
- One section per line
- Blank lines between sections for pauses
- URLs spelled out phonetically (e.g., "AI Skills Lab dot dev")
- Abbreviations expanded (e.g., "large language models" not "LLMs")

Store at `content/videos/[skill-name]/script.txt`

### Step 2 — Audio (LuxTTS) ✅ INSTALLED
Generate narration from the script. Run from `~/projects/business/LuxTTS`:

```bash
cd ~/projects/business/LuxTTS

uv run python tts.py \
  --text-file /path/to/script.txt \
  --voice ~/projects/business/high-impact-digital/content/brand-voice.wav \
  --output /path/to/final-audio.wav \
  --output-dir /path/to/segments/ \
  --speed 0.7 --t-shift 0.75 --steps 6 --gap 0.3 --rms 0.025 --ref-duration 30 --smooth
```

**Confirmed settings:** speed=0.7, t-shift=0.75, steps=6, gap=0.3, rms=0.025, ref-duration=30, smooth=on.

**Text preprocessing rules:**
- "aiskillslab.dev" → "AI Skills Lab dot dev"
- "LLMs" → "large language models"
- Spell out all URLs, file extensions, and acronyms
- The Gradio UI at `http://127.0.0.1:7860` has an auto-preprocessor (run `cd ~/projects/business/LuxTTS && uv run python app.py`)

**Brand voice:** `~/projects/business/high-impact-digital/content/brand-voice.wav` (Cartesia-generated, 65s reference clip)

### Step 3 — Measure Durations
After generating audio, get each segment's duration:

```bash
for f in segments/*.wav; do
  dur=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$f")
  echo "$(basename $f): ${dur}s"
done
```

These durations drive the slide timing.

### Step 4 — Slides (python-pptx → Keynote) ✅ INSTALLED
Generate a PowerPoint file programmatically using `python-pptx`:

```bash
cd ~/projects/business/LuxTTS
uv run python slides/generate_pptx.py --output /path/to/slides.pptx
```

**Design rules:**
- 16:9 widescreen (Inches(16) x Inches(9))
- Dark background: `#1a1c1e`
- Use brand colors from `content/brand-guide.md`
- One slide per audio segment
- Use `blank_layout` (index 6) for all slides
- Code blocks use Courier New font
- Body text uses Arial

For new videos, create a new `generate_[topic].py` based on `slides/generate_pptx.py` as a template. Each video gets its own slide generator.

Keynote opens .pptx files natively — no conversion needed.

### Step 5 — Assemble Video ✅ WORKING
Export slides from Keynote as PNGs, combine with audio segments:

```bash
cd ~/projects/business/LuxTTS
bash slides/keynote_assemble.sh
```

This script:
1. Opens the .pptx in Keynote via AppleScript
2. Exports all slides as PNGs
3. Pairs each slide PNG with its audio segment
4. Adds 0.3s gaps between segments
5. Concatenates into final MP4

Output: `~/Documents/[skill-name]-video.mp4`

### Step 6 — YouTube Upload ❓ NOT YET CONFIGURED
Upload finished videos. Check which method is available:
1. YouTube Data API v3 via the `youtube` MCP server (if `$YOUTUBE_API_KEY` is set)
2. If not: save upload-ready metadata to `upload-queue.json` and mark blocked

**Upload is irreversible** — verify title, description, tags, and privacy settings before executing.

## File System Tools
Read scripts, write video assets, organize the output directory.

## File Organization

```
content/videos/
└── [skill-name]/
    ├── script.txt           # TTS-ready script (one section per line)
    ├── segments/            # Individual WAV audio segments
    ├── final-audio.wav      # Stitched audio
    ├── slides.pptx          # Generated PowerPoint
    ├── generate_slides.py   # Slide generator script
    └── output/
        └── video.mp4        # Final assembled video
```

## Notes
- Always use the Paperclip skill for API calls — do not use raw curl/fetch.
- Always include `X-Paperclip-Run-Id` header on mutating calls.
- **Tool status:** LuxTTS ✅, python-pptx ✅, Keynote ✅, ffmpeg ✅, YouTube upload ❓
- Test TTS audio before generating slides. Catching pronunciation issues early saves a full regeneration.
- When blocked on tooling, produce everything you CAN and queue the rest.
- The pipeline is sequential — audio MUST be generated before slides, because slide timing depends on audio segment durations.
