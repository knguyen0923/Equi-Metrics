"""Configures the root logger once, at first import.

Imported for its side effect only — as the very first app.* import in
main.py (see there), before anything else that might log at module-load
time (e.g. app/ml/registry.py's startup category-mapping messages) so
those also use this format instead of falling back to logging's
unconfigured "no handlers found" behavior.
"""
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
