# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

# Automatically collect all playwright modules, driver binaries, and dependencies
datas, binaries, hiddenimports = collect_all('playwright')

# Add your local chromium directory to the bundle's root
datas.append(('chromium-1228', 'chromium-1228'))

a = Analysis(
    ['Scrapingtool.py'],  # <-- CHANGED from 'main.py' to 'Scrapingtool.py'
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
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
    [],
    exclude_binaries=True,
    name='Scrapingtool',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='Scrapingtool',
)