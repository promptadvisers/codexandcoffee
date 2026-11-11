"""Package the Python bridge from a temporary, non-personal source path."""
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory(prefix="relay-backend-build-") as directory:
    temp = Path(directory)
    shutil.copy2(root / "app/backend.py", temp / "backend.py")
    subprocess.run([
        sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--onedir",
        "--name", "relay-backend", "--collect-data", "certifi",
        "--distpath", str(root / "app/dist/backend"), "--workpath", str(temp / "work"),
        "--specpath", str(temp), str(temp / "backend.py"),
    ], cwd=temp, check=True)
