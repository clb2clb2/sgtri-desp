#!/usr/bin/env python3
"""
convert_fonts_to_base64.py
==========================
Convierte fuentes OTF/TTF a Base64 para usarlas en pdfmake.
Genera un archivo JS con el VFS (Virtual File System) de pdfmake.

Uso:
    python tools/convert_fonts_to_base64.py
"""

import base64
import os
from pathlib import Path

# Configuración
FONTS_DIR = Path(__file__).parent.parent / "assets" / "fonts"
OUTPUT_FILE = Path(__file__).parent.parent / "js" / "pdfFonts.js"

# Fuentes a convertir (nombre_archivo: nombre_interno)
FONTS_TO_CONVERT = {
    "HelveticaNeueLTStd-MdCn.otf": "HelveticaNeue-MediumCondensed",
    "HelveticaNeueLTStd-Roman.otf": "HelveticaNeue",
    "HelveticaNeueLTStd-Bd.otf": "HelveticaNeue-Bold",
    "HelveticaNeueLTStd-It.otf": "HelveticaNeue-Italic",
    "HelveticaNeueLTStd-BdCn.otf": "HelveticaNeue-BoldCondensed",
}


def convert_font_to_base64(font_path: Path) -> str:
    """Lee un archivo de fuente y lo convierte a Base64."""
    with open(font_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def generate_vfs_js(fonts: dict[str, str]) -> str:
    """Genera el contenido del archivo JS con el VFS de pdfmake."""
    lines = [
        "/**",
        " * pdfFonts.js",
        " * ============",
        " * Fuentes personalizadas para pdfmake (Virtual File System).",
        " * Generado automáticamente por tools/convert_fonts_to_base64.py",
        " *",
        " * NO EDITAR MANUALMENTE",
        " */",
        "",
        "(function(global) {",
        "  'use strict';",
        "",
        "  // Verificar que pdfMake está disponible",
        "  if (typeof pdfMake === 'undefined') {",
        "    console.error('[pdfFonts] pdfMake no está cargado');",
        "    return;",
        "  }",
        "",
        "  // Virtual File System con las fuentes",
        "  const customVfs = {",
    ]
    
    # Añadir cada fuente
    font_entries = []
    for font_name, font_data in fonts.items():
        # Dividir en líneas de 80 chars para legibilidad (opcional, pero muy largo)
        font_entries.append(f'    "{font_name}": "{font_data}"')
    
    lines.append(",\n".join(font_entries))
    
    lines.extend([
        "  };",
        "",
        "  // Añadir al VFS de pdfMake (merge con las fuentes existentes)",
        "  pdfMake.vfs = pdfMake.vfs || {};",
        "  Object.assign(pdfMake.vfs, customVfs);",
        "",
        "  // Definir la familia de fuentes",
        "  pdfMake.fonts = pdfMake.fonts || {};",
        "  Object.assign(pdfMake.fonts, {",
        "    'HelveticaNeue-MediumCondensed': {",
        "      normal: 'HelveticaNeue-MediumCondensed',",
        "      bold: 'HelveticaNeue-MediumCondensed',",
        "      italics: 'HelveticaNeue-MediumCondensed',",
        "      bolditalics: 'HelveticaNeue-MediumCondensed'",
        "    },",
        "    'HelveticaNeue-BoldCondensed': {",
        "      normal: 'HelveticaNeue-BoldCondensed',",
        "      bold: 'HelveticaNeue-BoldCondensed',",
        "      italics: 'HelveticaNeue-BoldCondensed',",
        "      bolditalics: 'HelveticaNeue-BoldCondensed'",
        "    },",
        "    'HelveticaNeue': {",
        "      normal: 'HelveticaNeue',",
        "      bold: 'HelveticaNeue-Bold',",
        "      italics: 'HelveticaNeue-Italic',",
        "      bolditalics: 'HelveticaNeue-Bold'",
        "    },",
        "    // Roboto viene incluida en vfs_fonts.js del CDN",
        "    'Roboto': {",
        "      normal: 'Roboto-Regular.ttf',",
        "      bold: 'Roboto-Medium.ttf',",
        "      italics: 'Roboto-Italic.ttf',",
        "      bolditalics: 'Roboto-MediumItalic.ttf'",
        "    }",
        "  });",
        "",
        "  console.log('[pdfFonts] Fuentes Helvetica Neue y Roboto cargadas correctamente');",
        "",
        "})(typeof window !== 'undefined' ? window : this);",
        ""
    ])
    
    return "\n".join(lines)


def main():
    print("=" * 60)
    print("Conversión de fuentes a Base64 para pdfmake")
    print("=" * 60)
    
    if not FONTS_DIR.exists():
        print(f"ERROR: Directorio de fuentes no encontrado: {FONTS_DIR}")
        return 1
    
    fonts = {}
    total_size = 0
    
    for font_file, font_name in FONTS_TO_CONVERT.items():
        font_path = FONTS_DIR / font_file
        
        if not font_path.exists():
            print(f"⚠️  Fuente no encontrada: {font_file}")
            continue
        
        file_size = font_path.stat().st_size
        total_size += file_size
        
        print(f"✓ Convirtiendo {font_file} ({file_size / 1024:.1f} KB)...")
        fonts[font_name] = convert_font_to_base64(font_path)
    
    if not fonts:
        print("ERROR: No se encontraron fuentes para convertir")
        return 1
    
    # Generar archivo JS
    print(f"\n📝 Generando {OUTPUT_FILE}...")
    js_content = generate_vfs_js(fonts)
    
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(js_content)
    
    output_size = OUTPUT_FILE.stat().st_size
    
    print("\n" + "=" * 60)
    print("✅ Conversión completada")
    print(f"   Fuentes procesadas: {len(fonts)}")
    print(f"   Tamaño original: {total_size / 1024:.1f} KB")
    print(f"   Tamaño JS generado: {output_size / 1024:.1f} KB")
    print(f"   Archivo: {OUTPUT_FILE}")
    print("=" * 60)
    
    return 0


if __name__ == "__main__":
    exit(main())
