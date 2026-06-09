from io import BytesIO
from pathlib import Path

import pytest
from docx import Document

from app import app, create_app


def build_docx_bytes(paragraphs: list[str]) -> BytesIO:
    document = Document()
    for text in paragraphs:
        document.add_paragraph(text)

    buffer = BytesIO()
    document.save(buffer)
    buffer.seek(0)
    return buffer


@pytest.fixture()
def client():
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client


def test_index_page_renders(client) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert "word".encode("utf-8") in response.data.lower()


def test_convert_returns_excel_file(client) -> None:
    file_obj = build_docx_bytes(
        [
            "\u3010\u767d\u9053\u957f\u3011\u4f60\u6765\u4e86",
            "\u573a\u666f\u4e00 \u591c \u5916",
        ]
    )

    response = client.post(
        "/api/convert",
        data={
            "include_original": "true",
            "file": (file_obj, "\u5267\u672c.docx"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    assert response.mimetype == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert "%E5%89%A7%E6%9C%AC-%E9%85%8D%E8%A1%A8.xlsx" in response.headers["Content-Disposition"]


def test_preview_returns_rows_for_visual_confirmation(client) -> None:
    file_obj = build_docx_bytes(
        [
            "\u3010\u767d\u9053\u957f\u3011\u4f60\u6765\u4e86",
            "\u573a\u666f\u4e00 \u591c \u5916",
        ]
    )

    response = client.post(
        "/api/preview",
        data={
            "file": (file_obj, "\u5267\u672c.docx"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    assert response.get_json() == {
        "rows": [
            {
                "speaker": "\u767d\u9053\u957f",
                "content": "\u4f60\u6765\u4e86",
                "original_text": "\u3010\u767d\u9053\u957f\u3011\u4f60\u6765\u4e86",
            },
            {
                "speaker": "\u65c1\u767d",
                "content": "\u573a\u666f\u4e00 \u591c \u5916",
                "original_text": "\u573a\u666f\u4e00 \u591c \u5916",
            },
        ]
    }


def test_export_rows_returns_excel_from_edited_preview_rows(client) -> None:
    response = client.post(
        "/api/export-rows",
        json={
            "source_filename": "\u5267\u672c.docx",
            "columns": [
                {"key": "speaker", "label": "\u89d2\u8272"},
                {"key": "content", "label": "\u53f0\u8bcd"},
                {"key": "original_text", "label": "\u539f\u6587"},
            ],
            "rows": [
                {
                    "speaker": "\u6539\u8fc7\u7684\u767d\u9053\u957f",
                    "content": "\u6539\u597d\u7684\u53f0\u8bcd",
                    "original_text": "\u3010\u767d\u9053\u957f\u3011\u4f60\u6765\u4e86",
                }
            ],
        },
    )

    assert response.status_code == 200
    assert response.mimetype == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert "%E5%89%A7%E6%9C%AC-%E9%85%8D%E8%A1%A8.xlsx" in response.headers["Content-Disposition"]


def test_export_rows_rejects_empty_rows(client) -> None:
    response = client.post(
        "/api/export-rows",
        json={
            "source_filename": "\u5267\u672c.docx",
            "columns": [
                {"key": "speaker", "label": "\u89d2\u8272"},
                {"key": "content", "label": "\u53f0\u8bcd"},
            ],
            "rows": [],
        },
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": "\u6ca1\u6709\u53ef\u5bfc\u51fa\u7684\u9884\u89c8\u6570\u636e"}


def test_export_rows_supports_custom_columns(client) -> None:
    response = client.post(
        "/api/export-rows",
        json={
            "source_filename": "\u5267\u672c.docx",
            "columns": [
                {"key": "speaker", "label": "\u89d2\u8272"},
                {"key": "mood", "label": "\u60c5\u7eea"},
                {"key": "content", "label": "\u53f0\u8bcd"},
            ],
            "rows": [
                {
                    "speaker": "\u767d\u9053\u957f",
                    "mood": "\u51b7\u9759",
                    "content": "\u4f60\u6765\u4e86",
                    "original_text": "\u3010\u767d\u9053\u957f\u3011\u4f60\u6765\u4e86",
                }
            ],
        },
    )

    assert response.status_code == 200


def test_convert_rejects_non_docx_file(client) -> None:
    response = client.post(
        "/api/convert",
        data={
            "file": (BytesIO(b"plain text"), "\u5267\u672c.txt"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": "\u4ec5\u652f\u6301\u4e0a\u4f20 .docx \u6587\u4ef6"}


def test_convert_rejects_invalid_docx_content(client) -> None:
    response = client.post(
        "/api/convert",
        data={
            "file": (BytesIO(b"bad docx"), "\u5267\u672c.docx"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert response.get_json() == {
        "error": "\u65e0\u6cd5\u89e3\u6790\u8be5 Word \u6587\u4ef6\uff0c\u8bf7\u786e\u8ba4\u6587\u4ef6\u672a\u635f\u574f"
    }


def test_convert_rejects_docx_without_readable_content(client) -> None:
    file_obj = build_docx_bytes([" ", "   "])

    response = client.post(
        "/api/convert",
        data={
            "file": (file_obj, "\u7a7a\u767d\u5267\u672c.docx"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": "\u672a\u8bfb\u53d6\u5230\u53ef\u5bfc\u51fa\u7684\u5267\u672c\u5185\u5bb9"}


def test_preview_rejects_non_docx_file(client) -> None:
    response = client.post(
        "/api/preview",
        data={
            "file": (BytesIO(b"plain text"), "\u5267\u672c.txt"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": "\u4ec5\u652f\u6301\u4e0a\u4f20 .docx \u6587\u4ef6"}


def test_create_app_uses_explicit_resource_root(tmp_path: Path) -> None:
    templates_dir = tmp_path / "templates"
    static_dir = tmp_path / "static"
    templates_dir.mkdir()
    static_dir.mkdir()

    custom_app = create_app(resource_root=tmp_path)

    assert Path(custom_app.template_folder) == templates_dir
    assert Path(custom_app.static_folder) == static_dir
