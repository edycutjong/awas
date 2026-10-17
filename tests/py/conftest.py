"""Load scripts/*.py as modules (they are CLI scripts, not a package)."""
import importlib.util
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"


def load_script(name):
    spec = importlib.util.spec_from_file_location(f"scripts_{name}", SCRIPTS / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture
def script():
    return load_script


def run_as_main(name, *argv):
    """Execute a script the way `python3 scripts/<name>.py <argv>` does (covers the `__main__` guard)."""
    import runpy

    old = sys.argv
    sys.argv = [f"{name}.py", *argv]
    try:
        with pytest.raises(SystemExit) as exc:
            runpy.run_path(str(SCRIPTS / f"{name}.py"), run_name="__main__")
    finally:
        sys.argv = old
    return exc.value.code


class FakeResp:
    """What urllib.request.urlopen returns, as a context manager."""

    def __init__(self, body=b"", status=200, headers=None):
        self._body = body if isinstance(body, bytes) else body.encode()
        self.status = status
        self.headers = headers or {}

    def read(self, *a):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def getcode(self):
        return self.status
