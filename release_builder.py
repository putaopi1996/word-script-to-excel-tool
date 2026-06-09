from __future__ import annotations

import shutil
from pathlib import Path


PACKAGE_NAME = "word-script-excel-tool"
RUNTIME_FILES = [
    "app.py",
    "requirements.txt",
    "README.md",
]
RUNTIME_DIRS = [
    "services",
    "static",
    "templates",
]
EXCLUDED_DIR_NAMES = {"__pycache__", ".pytest_cache", "tests", "dist"}
LAUNCHER_NAME = "run_tool.bat"


def project_root() -> Path:
    return Path(__file__).resolve().parent


def _reset_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def _copy_tree(source: Path, destination: Path) -> None:
    shutil.copytree(
        source,
        destination,
        ignore=shutil.ignore_patterns(*EXCLUDED_DIR_NAMES, "*.pyc"),
    )


def launcher_script() -> str:
    return """@echo off
setlocal

cd /d "%~dp0"

set "PY_CMD="

python -V >nul 2>nul
if not errorlevel 1 set "PY_CMD=python"
if not defined PY_CMD (
    py -V >nul 2>nul
    if not errorlevel 1 set "PY_CMD=py"
)
if not defined PY_CMD (
    for /f "delims=" %%I in ('dir /b /ad "%LocalAppData%\\Programs\\Python\\Python*" 2^>nul') do (
        if exist "%LocalAppData%\\Programs\\Python\\%%I\\python.exe" (
            set "PY_CMD=%LocalAppData%\\Programs\\Python\\%%I\\python.exe"
        )
    )
)
if not defined PY_CMD (
    echo Python was not found. Please install Python 3.11+ first.
    pause
    exit /b 1
)

if not exist ".venv\\Scripts\\python.exe" (
    echo Creating virtual environment...
    "%PY_CMD%" -m venv ".venv"
    if errorlevel 1 (
        echo Failed to create .venv
        pause
        exit /b 1
    )
)

echo Installing or updating dependencies...
".venv\\Scripts\\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
    echo Failed to install dependencies.
    pause
    exit /b 1
)

echo Opening browser...
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:5000"

echo Starting WebUI server...
".venv\\Scripts\\python.exe" app.py

if errorlevel 1 (
    echo Server stopped or failed to start.
    pause
)
"""


def build_distribution(root: Path | None = None, dist_root: Path | None = None) -> Path:
    root = root or project_root()
    dist_root = dist_root or root / "dist"
    package_dir = dist_root / PACKAGE_NAME
    _reset_dir(package_dir)

    for file_name in RUNTIME_FILES:
        shutil.copy2(root / file_name, package_dir / file_name)

    for dir_name in RUNTIME_DIRS:
        _copy_tree(root / dir_name, package_dir / dir_name)

    (package_dir / LAUNCHER_NAME).write_text(launcher_script(), encoding="utf-8", newline="\r\n")
    return package_dir


def build_zip_archive(package_dir: Path) -> Path:
    archive_base = package_dir.parent / package_dir.name
    archive_path = shutil.make_archive(str(archive_base), "zip", package_dir.parent, package_dir.name)
    return Path(archive_path)


def main() -> int:
    root = project_root()
    package_dir = build_distribution(root, root / "dist")
    zip_path = build_zip_archive(package_dir)
    print(f"Package directory: {package_dir}")
    print(f"Zip archive: {zip_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
