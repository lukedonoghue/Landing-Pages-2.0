#!/usr/bin/env python3
"""Validate canonical records and any retained legacy views, never a second draft."""
from pathlib import Path
import argparse
import json
import re
import sys


def validate(root, stage='build'):
    import copy_contract
    import completion_contract as contract
    root = Path(root).resolve()
    required = list(copy_contract.copy_files(root).values())
    if stage != 'copy':
        required += ['build/research-acceptance.json', 'research/reviews/review-manifest.json',
                     'build/brand.json', 'build/conversion-contract.json', 'image-plan.json',
                     'build/page-structure.json', 'build/reference-fidelity.json']
    errors=[]
    for name in required:
        try:
            import workflow_storage
            path=workflow_storage.path_inside(root,name)
            value=path.read_text()
            if not value.strip() or 'WORKFLOW_TEMPLATE_INCOMPLETE' in value:
                raise ValueError('Empty or unfinished canonical record: '+name)
            if path.suffix=='.json' and json.loads(value) in ({},[],None):
                raise ValueError('Empty canonical record: '+name)
        except (OSError,ValueError,TypeError) as error:
            errors.append('Required records: '+str(error))
    # Existing docs are still checked. Migration does not delete template markers.
    for path in sorted((root/'docs').glob('*.md')):
        try:
            value=path.read_text()
            if 'WORKFLOW_TEMPLATE_INCOMPLETE' in value:
                errors.append('Workflow template is still incomplete: '+path.relative_to(root).as_posix())
            else:
                import process_contract
                meaningful=process_contract.meaningful_text(value)
                if not meaningful.strip():
                    errors.append('Empty workflow document: '+path.relative_to(root).as_posix())
                if path.name in {'QA-REPORT.md','PREVIEW-QA.md'}:
                    lines=[line.strip() for line in value.splitlines()]
                    table_data=[]
                    for i,line in enumerate(lines):
                        cells=line.strip('|').split('|')
                        if line.startswith('|') and len(cells)>=2 and all(re.fullmatch(r':?-{3,}:?', cell.strip()) for cell in cells):
                            for row in lines[i+1:]:
                                if not row.startswith('|'):break
                                values=[cell.strip() for cell in row.strip('|').split('|')]
                                if len(values)==len(cells) and all(values):table_data.append(row)
                            break
                    if not table_data:errors.append('QA report has no actual result rows: '+path.relative_to(root).as_posix())
        except (OSError,ValueError) as error: errors.append(str(error))
    errors += contract.document_source_errors(root)
    return errors


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('project',type=Path);p.add_argument('--stage',choices=['copy','build'],default='build')
    a=p.parse_args();errors=validate(a.project,a.stage)
    print(json.dumps({'status':'blocked' if errors else 'pass','failures':errors},indent=2));return bool(errors)

if __name__=='__main__':sys.exit(main())
