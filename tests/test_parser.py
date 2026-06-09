from io import BytesIO

import pytest
from docx import Document

from services.parser import parse_document, parse_paragraph_text


SPEAKER_BAIDAOZHANG = "\u767d\u9053\u957f"
SPEAKER_NARRATOR = "\u65c1\u767d"
SPEAKER_ME = "\u6211"
SPEAKER_FOX = "\u72d0\u5996\u5c0f\u53ae"


def build_docx_bytes(paragraphs: list[str]) -> BytesIO:
    document = Document()
    for text in paragraphs:
        document.add_paragraph(text)

    buffer = BytesIO()
    document.save(buffer)
    buffer.seek(0)
    return buffer


@pytest.mark.parametrize(
    ("text", "speaker", "content"),
    [
        ("\u3010\u767d\u9053\u957f\u3011\u4f60\u6765\u4e86", SPEAKER_BAIDAOZHANG, "\u4f60\u6765\u4e86"),
        ("\u3010\u6211\u3011", SPEAKER_ME, ""),
        ("\u573a\u666f\u4e00 \u591c \u5916", SPEAKER_NARRATOR, "\u573a\u666f\u4e00 \u591c \u5916"),
        ("\uff08\u98ce\u58f0\u6e10\u8d77\uff09", SPEAKER_NARRATOR, "\uff08\u98ce\u58f0\u6e10\u8d77\uff09"),
        ("  \u3010\u72d0\u5996\u5c0f\u53ae\u3011  \u8bf7\u8fdb  ", SPEAKER_FOX, "\u8bf7\u8fdb"),
    ],
)
def test_parse_paragraph_text_returns_expected_fields(
    text: str, speaker: str, content: str
) -> None:
    row = parse_paragraph_text(text)

    assert row.original_text == text.strip()
    assert row.speaker == speaker
    assert row.content == content


def test_parse_document_skips_blank_paragraphs_and_keeps_order() -> None:
    file_obj = build_docx_bytes(
        [
            "\u3010\u767d\u9053\u957f\u3011\u4f60\u6765\u4e86",
            " ",
            "\u573a\u666f\u4e00 \u591c \u5916",
            "\u3010\u6211\u3011",
        ]
    )

    rows = parse_document(file_obj)

    assert [row.speaker for row in rows] == [SPEAKER_BAIDAOZHANG, SPEAKER_NARRATOR, SPEAKER_ME]
    assert [row.content for row in rows] == ["\u4f60\u6765\u4e86", "\u573a\u666f\u4e00 \u591c \u5916", ""]


def test_parse_document_raises_for_empty_document() -> None:
    file_obj = build_docx_bytes([" ", "   "])

    with pytest.raises(ValueError, match="\u672a\u8bfb\u53d6\u5230\u53ef\u5bfc\u51fa\u7684\u5267\u672c\u5185\u5bb9"):
        parse_document(file_obj)
