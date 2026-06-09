from pathlib import Path

from exe_builder import (
    build_pyinstaller_command,
    create_release_folder,
    runtime_launcher_script,
)


def write_file(path: Path, content: str = "x") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def create_runtime_tree(root: Path) -> None:
    write_file(root / "README.md", "# demo")
    write_file(root / "最新版(1).docx", "sample")


def test_build_pyinstaller_command_includes_templates_and_static(tmp_path: Path) -> None:
    command = build_pyinstaller_command(tmp_path)

    joined = " ".join(command)
    assert "--noconfirm" in command
    assert "--onefile" in command
    assert command[-1].endswith("desktop_entry.py")
    assert "templates;templates" in joined
    assert "static;static" in joined


def test_create_release_folder_copies_exe_and_writes_launcher(tmp_path: Path) -> None:
    project_root = tmp_path / "project"
    dist_dir = project_root / "pyinstaller-dist"
    dist_dir.mkdir(parents=True)
    write_file(dist_dir / "word-script-excel-tool.exe", "binary")
    create_runtime_tree(project_root)

    release_dir = create_release_folder(project_root, project_root / "dist")

    assert (release_dir / "word-script-excel-tool.exe").exists()
    assert (release_dir / "README.md").exists()
    assert (release_dir / "run_tool.bat").exists()
    assert not (release_dir / "最新版(1).docx").exists()


def test_runtime_launcher_runs_bundled_exe() -> None:
    launcher = runtime_launcher_script()

    assert "word-script-excel-tool.exe" in launcher
    assert ".venv" not in launcher
