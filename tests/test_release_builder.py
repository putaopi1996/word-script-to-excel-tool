from pathlib import Path
from zipfile import ZipFile

from release_builder import build_distribution, build_zip_archive


def write_file(path: Path, content: str = "x") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def create_project_tree(root: Path) -> None:
    write_file(root / "app.py", "print('app')")
    write_file(root / "requirements.txt", "Flask==3.1.1")
    write_file(root / "README.md", "# demo")
    write_file(root / "services" / "__init__.py", "")
    write_file(root / "services" / "parser.py", "PARSER = True")
    write_file(root / "services" / "__pycache__" / "skip.pyc", "cache")
    write_file(root / "static" / "app.js", "console.log('x')")
    write_file(root / "templates" / "index.html", "<html></html>")
    write_file(root / "tests" / "test_app.py", "assert True")


def test_build_distribution_copies_runtime_files_and_generates_launcher(tmp_path: Path) -> None:
    project_root = tmp_path / "project"
    create_project_tree(project_root)

    package_dir = build_distribution(project_root, tmp_path / "dist")

    assert (package_dir / "app.py").exists()
    assert (package_dir / "requirements.txt").exists()
    assert (package_dir / "README.md").exists()
    assert (package_dir / "services" / "parser.py").exists()
    assert (package_dir / "static" / "app.js").exists()
    assert (package_dir / "templates" / "index.html").exists()
    assert (package_dir / "run_tool.bat").exists()
    assert not (package_dir / "tests").exists()
    assert not (package_dir / "services" / "__pycache__").exists()


def test_generated_launcher_bootstraps_venv(tmp_path: Path) -> None:
    project_root = tmp_path / "project"
    create_project_tree(project_root)

    package_dir = build_distribution(project_root, tmp_path / "dist")
    launcher = (package_dir / "run_tool.bat").read_text(encoding="utf-8")

    assert ".venv" in launcher
    assert "python -m venv" in launcher or '"%PY_CMD%" -m venv ".venv"' in launcher
    assert "requirements.txt" in launcher
    assert "app.py" in launcher


def test_build_zip_archive_creates_zip_with_package_contents(tmp_path: Path) -> None:
    project_root = tmp_path / "project"
    create_project_tree(project_root)
    package_dir = build_distribution(project_root, tmp_path / "dist")

    zip_path = build_zip_archive(package_dir)

    assert zip_path.exists()
    with ZipFile(zip_path) as zip_file:
        names = set(zip_file.namelist())

    root_name = package_dir.name
    assert f"{root_name}/app.py" in names
    assert f"{root_name}/run_tool.bat" in names
