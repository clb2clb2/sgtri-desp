# small script to extract text from a .docx (reads word/document.xml inside the .docx zip)
import zipfile
import sys
from xml.etree import ElementTree as ET

if len(sys.argv) < 2:
    print('Usage: python extract_docx_text.py file.docx [out.txt]')
    sys.exit(2)

infile = sys.argv[1]
outfile = sys.argv[2] if len(sys.argv) > 2 else infile + '.txt'

with zipfile.ZipFile(infile) as z:
    if 'word/document.xml' not in z.namelist():
        print('document.xml not found inside .docx')
        sys.exit(1)
    data = z.read('word/document.xml')

# Parse XML and extract text nodes
root = ET.fromstring(data)
# Word namespace often used
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
texts = []
for para in root.findall('.//w:p', ns):
    parts = []
    for node in para.findall('.//w:t', ns):
        parts.append(node.text or '')
    if parts:
        texts.append(''.join(parts))

with open(outfile, 'w', encoding='utf-8') as f:
    f.write('\n\n'.join(texts))

print('Extracted to', outfile)
