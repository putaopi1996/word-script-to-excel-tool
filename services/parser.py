from __future__ import annotations

import zipfile
from dataclasses import dataclass
from io import BytesIO
from typing import BinaryIO

from docx import Document
from docx.opc.exceptions import PackageNotFoundError


NARRATOR_SPEAKER = "\u65c1\u767d"


@dataclass(slots=True)
class ScriptRow:
    original_text: str
    speaker: str
    content: str


def parse_paragraph_text(text: str) -> ScriptRow:
    normalized = text.strip()
    speaker = NARRATOR_SPEAKER
    content = normalized

    if normalized.startswith("\u3010") and "\u3011" in normalized:
        raw_speaker, raw_content = normalized[1:].split("\u3011", 1)
        candidate_speaker = raw_speaker.strip()
        if candidate_speaker:
            speaker = candidate_speaker
            content = raw_content.strip()

    return ScriptRow(
        original_text=normalized,
        speaker=speaker,
        content=content,
    )


def parse_document(file_obj: BinaryIO) -> list[ScriptRow]:
    try:
        data = file_obj.read()
        document = Document(BytesIO(data))
    except (PackageNotFoundError, KeyError, ValueError, OSError, zipfile.BadZipFile):
        raise ValueError("\u65e0\u6cd5\u89e3\u6790\u8be5 Word \u6587\u4ef6\uff0c\u8bf7\u786e\u8ba4\u6587\u4ef6\u672a\u635f\u574f") from None

    rows: list[ScriptRow] = []
    for paragraph in document.paragraphs:
        if not paragraph.text or not paragraph.text.strip():
            continue
        rows.append(parse_paragraph_text(paragraph.text))

    if not rows:
        raise ValueError("\u672a\u8bfb\u53d6\u5230\u53ef\u5bfc\u51fa\u7684\u5267\u672c\u5185\u5bb9")

    return rows
