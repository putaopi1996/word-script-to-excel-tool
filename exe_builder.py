from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


APP_NAME = "word-script-excel-tool"
DIST_DIR_NAME = "dist"
PYINSTALLER_DIST_DIR_NAME = "pyinstaller-dist"
RELEASE_FILES = ["README.md"]
EXCLUDED_RELEASE_FILES = {"*.docx", "*.zip", "*.rar"}


def project_root() -> Path:
    return Path(__file__).resolve().parent


def build_pyinstaller_command(root: Path) -> list[str]:
    entry_script = root / "desktop_entry.py"
    dist_dir = root / PYINSTALLER_DIST_DIR_NAME
    build_dir = root / "build" / "pyinstaller"

    return [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--name",
        APP_NAME,
        "--distpath",
        str(dist_dir),
        "--workpath",
        str(build_dir),
        "--add-data",
        f"{root / 'templates'};templates",
        "--add-data",
        f"{root / 'static'};static",
        "--add-data",
        f"{root / 'changelog.json'};.",
        str(entry_script),
    ]


def runtime_launcher_script() -> str:
    return f"""@echo off
setlocal

cd /d "%~dp0"

if not exist "{APP_NAME}.exe" (
    echo {APP_NAME}.exe was not found.
    pause
    exit /b 1
)

start "" "{APP_NAME}.exe"
"""


def _reset_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def create_release_folder(root: Path, dist_root: Path) -> Path:
    dist_root.mkdir(parents=True, exist_ok=True)
    release_dir = dist_root / APP_NAME
    _reset_dir(release_dir)

    exe_source = root / PYINSTALLER_DIST_DIR_NAME / f"{APP_NAME}.exe"
    shutil.copy2(exe_source, release_dir / exe_source.name)

    for file_name in RELEASE_FILES:
        shutil.copy2(root / file_name, release_dir / file_name)

    (release_dir / "run_tool.bat").write_text(
        runtime_launcher_script(),
        encoding="utf-8",
        newline="\r\n",
    )
    return release_dir


def build_zip_archive(package_dir: Path) -> Path:
    archive_base = package_dir.parent / package_dir.name
    archive_path = shutil.make_archive(str(archive_base), "zip", package_dir.parent, package_dir.name)
    return Path(archive_path)


def build_exe_distribution(root: Path | None = None) -> tuple[Path, Path]:
    root = root or project_root()
    command = build_pyinstaller_command(root)
    subprocess.run(command, cwd=root, check=True)
    release_dir = create_release_folder(root, root / DIST_DIR_NAME)
    zip_path = build_zip_archive(release_dir)
    return release_dir, zip_path


def main() -> int:
    release_dir, zip_path = build_exe_distribution(project_root())
    print(f"Release directory: {release_dir}")
    print(f"Zip archive: {zip_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
