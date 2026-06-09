# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['E:\\ai\\vibe coding\\配表工具\\desktop_entry.py'],
    pathex=[],
    binaries=[],
    datas=[('E:\\ai\\vibe coding\\配表工具\\templates', 'templates'), ('E:\\ai\\vibe coding\\配表工具\\static', 'static'), ('E:\\ai\\vibe coding\\配表工具\\changelog.json', '.')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='word-script-excel-tool',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
