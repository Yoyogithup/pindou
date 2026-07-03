#!/usr/bin/env python3
"""Centralized Jinja2 template configuration."""

from __future__ import annotations

from pathlib import Path

from fastapi.templating import Jinja2Templates
from jinja2 import Environment, FileSystemLoader

ROOT = Path(__file__).resolve().parents[1]

# Disable template caching to work around Python 3.14 compatibility issue
jinja_env = Environment(
    loader=FileSystemLoader(str(ROOT / "web" / "templates")),
    cache_size=0,
)
templates = Jinja2Templates(env=jinja_env)
