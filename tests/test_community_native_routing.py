"""Expose the isolated native-routing suite to the existing repository unittest CI."""
from pathlib import Path
import runpy
import unittest

_suite = Path(__file__).resolve().parents[1] / 'skills/community-landing-page-builder/tests/test_native_routing.py'
for _name, _value in runpy.run_path(str(_suite)).items():
    if isinstance(_value, type) and issubclass(_value, unittest.TestCase):
        globals()[_name] = _value

del _name, _value
