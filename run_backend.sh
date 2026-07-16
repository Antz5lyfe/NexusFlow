#!/bin/bash
cd /Users/macbookpro/Desktop/nex/NexusFlow
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
