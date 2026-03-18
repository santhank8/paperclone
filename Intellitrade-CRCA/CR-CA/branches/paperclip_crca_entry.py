#!/usr/bin/env python3
"""
Paperclip heartbeat entrypoint (same as `crca-q run --json`).

Install: pip install -e <repo>/Intellitrade-CRCA/crca_q

Process adapter command may be:
  python paperclip_crca_entry.py run --json
(with cwd = Intellitrade-CRCA/CR-CA/branches and PYTHONPATH including crca_q, or use global crca-q).
"""
from crca_q.cli import main

if __name__ == "__main__":
    main()
