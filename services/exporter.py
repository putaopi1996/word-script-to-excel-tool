from __future__ import annotations

from io import BytesIO

from openpyxl import Workbook

from services.parser import ScriptRow


def export_table_to_excel(columns: list[dict[str, str]], rows: list[dict[str, str]]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "\u914d\u8868"

    headers = [column["label"] for column in columns]
    sheet.append(headers)

    for row in rows:
        values = [row.get(column["key"], "") for column in columns]
        sheet.append(values)

    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def export_rows_to_excel(rows: list[ScriptRow], include_original: bool) -> bytes:
    columns = [
        {"key": "speaker", "label": "\u89d2\u8272"},
        {"key": "content", "label": "\u53f0\u8bcd"},
    ]
    if include_original:
        columns.append({"key": "original_text", "label": "\u539f\u6587"})

    serialized_rows = [
        {
            "speaker": row.speaker,
            "content": row.content,
            "original_text": row.original_text,
        }
        for row in rows
    ]
    return export_table_to_excel(columns, serialized_rows)
