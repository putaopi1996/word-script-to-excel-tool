from pathlib import Path
import subprocess


def test_app_js_has_valid_syntax() -> None:
    script_path = Path(__file__).resolve().parents[1] / "static" / "app.js"
    result = subprocess.run(
        ["node", "--check", str(script_path)],
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr


def test_app_js_supports_content_count_and_no_column_controls() -> None:
    script_path = Path(__file__).resolve().parents[1] / "static" / "app.js"
    content = script_path.read_text(encoding="utf-8")

    assert "countBadge" in content
    assert "content-count" in content
    assert "insertColumnAt" not in content
    assert "removeColumn" not in content
