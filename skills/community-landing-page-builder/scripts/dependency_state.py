#!/usr/bin/env python3
"""One portable input/output graph; hashes reject stale evidence, never certify quality."""
from pathlib import Path
import argparse
import json
import sys

DOMAINS = {
    'public/index.html': ['browser','visual','performance','browser_compat','rendered_copy','control_review','thank_you','final_review'],
    'build/page-copy.json': ['copy','rendered_copy','claim_review','guide','thank_you','control_review','final_review'],
    'build/page-copy.md': ['copy','rendered_copy','claim_review','guide','thank_you','control_review','final_review'],
    'image-plan.json': ['images','browser','performance','visual','guide','final_review'],
    'build/guide.json': ['catalogue','thank_you','browser','rendered_copy','final_review'],
    'build/thank-you.json': ['thank_you','catalogue','browser','rendered_copy','final_review'],
    'public/script.js': ['browser','browser_compat','local_journey','final_review'],
}


def refs(root, names):
    import completion_contract as c
    import workflow_storage as storage
    result={}
    for name in names:
        path=storage.path_inside(root,name)
        if not path.is_file():raise ValueError('Dependency is missing: '+name)
        ref={'path':name,'sha256':c.digest(path)}
        c.evidence(root,ref)
        result[name]=ref['sha256']
    return result


def record(root, name, inputs, outputs):
    """Called after a build helper succeeds. This records bytes, not acceptance."""
    import workflow_storage as storage
    import check_gates
    root=Path(root).resolve()
    if name not in {'main_page','guide','thank_you'}:raise ValueError('Unknown generated surface')
    if not inputs or not outputs or set(inputs)&set(outputs):raise ValueError('Distinct, nonempty dependency inputs and outputs are required')
    row={'inputs':refs(root,inputs),'outputs':refs(root,outputs),'recorded_at':check_gates.now()}
    with storage.lock(root):
        graph=storage.read(root,'build/dependency-manifest.json',{'schema_version':1,'nodes':{}})
        if graph.get('schema_version')!=1:raise ValueError('Unsupported dependency manifest')
        graph['nodes'][name]=row
        storage.write(root,'build/dependency-manifest.json',graph)
    return row


def inspect(root):
    import completion_contract as c
    import copy_contract
    root=Path(root).resolve();errors=[]
    try:
        config=c.read(root/'funnel.json');graph=c.read(root/'build/dependency-manifest.json')
        if graph.get('schema_version')!=1:raise ValueError('Unsupported dependency manifest')
        nodes=graph.get('nodes',{})
        main='public/index.html' if (root/'public/index.html').is_file() else 'index.html'
        expected={'main_page':({copy_contract.copy_files(root)['copy']},{main})}
        if config.get('catalogue',{}).get('enabled',True):
            build=c.read(root/'build/guide-build.json')
            # The existing guide validator derives ALL content/image inputs. A
            # handwritten dependency row cannot weaken that source-bound check.
            import guide_quality
            guide_quality.inspect_build(root)
            inputs=set(build.get('inputs',{}))|{'build/guide.json'}
            pdf=build.get('pdf',{})
            pdf_path=pdf.get('path') if isinstance(pdf,dict) else pdf
            pdf_path=pdf_path or build.get('output') or 'public/assets/brochure/service-guide.pdf'
            expected['guide']=(inputs,{pdf_path})
        thank=root/'public/thank-you.html'
        if thank.is_file():
            import thank_you_page
            thank_you_page.inspect(root)
            pdf_inputs=expected.get('guide',(set(),set()))[1]
            expected['thank_you']=({main,'build/thank-you.json',*pdf_inputs},{'public/thank-you.html'})
        for name,(inputs,outputs) in expected.items():
            row=nodes.get(name,{})
            if not inputs.issubset(row.get('inputs',{})) or not outputs.issubset(row.get('outputs',{})):
                errors.append('Dependency graph omits required edges: '+name);continue
            for kind in ('inputs','outputs'):
                values=row.get(kind,{})
                if not isinstance(values,dict) or not values:raise ValueError('Empty dependency '+kind+': '+name)
                for path,sha in values.items():c.evidence(root,{'path':path,'sha256':sha})
    except (OSError,ValueError,KeyError,TypeError,AttributeError) as error:errors.append('Dependencies: '+str(error))
    return errors


def changes(root):
    import check_gates
    import completion_contract as c
    root=Path(root).resolve();now=check_gates.source_snapshot(root)
    path=root/'build/gate-snapshot.json'
    old=c.read(path).get('files',{}) if path.is_file() else {}
    changed=sorted(k for k in set(old)|set(now['files']) if old.get(k)!=now['files'].get(k))
    # Unknown material files conservatively invalidate all verification. This
    # map improves recovery explanations; it never permits selective stale QA.
    domains=set()
    for name in changed:
        domains.update(DOMAINS.get(name,check_gates.GATES))
    return {'source_fingerprint':now['source_fingerprint'],'changed_files':changed,
            'invalidated_domains':sorted(domains),'first_changed_dependency':changed[0] if changed else None}


def runtime_identity(root):
    """Separate tool identity from product identity, including when not installed."""
    import completion_contract as c
    root=Path(root).resolve();folder=root/'.community-builder'
    files={}
    if folder.exists():
        if folder.is_symlink():raise ValueError('Installed tool runtime must not be a symlink')
        for path in sorted(folder.rglob('*')):
            if any(p in {'.git','.secrets','node_modules','__pycache__','.venv'} for p in path.relative_to(folder).parts):continue
            if path.is_symlink():raise ValueError('Tool runtime symlink is unsupported')
            if path.is_file() and path.suffix in {'.py','.mjs','.js','.json','.md','.toml'}:
                files[path.relative_to(folder).as_posix()]=c.digest(path)
    import hashlib
    return {'schema_version':1,'kind':'installed_tool_runtime' if files else 'external_validator',
            'files':files,'fingerprint':hashlib.sha256(json.dumps(files,sort_keys=True).encode()).hexdigest(),
            'validator_version':'completion-contract-4','scope':'Tool implementation identity, not product source or provider authentication'}


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('command',choices=['check','changes','record','runtime']);p.add_argument('project',type=Path)
    p.add_argument('--node',choices=['main_page','guide','thank_you']);p.add_argument('--input',action='append',default=[]);p.add_argument('--output',action='append',default=[])
    a=p.parse_args()
    try:
        if a.command=='record':result=record(a.project,a.node,a.input,a.output)
        elif a.command=='changes':result=changes(a.project)
        elif a.command=='runtime':result=runtime_identity(a.project)
        else:
            errors=inspect(a.project);result={'status':'blocked' if errors else 'pass','failures':errors}
        print(json.dumps(result,indent=2));return bool(result.get('failures'))
    except (OSError,ValueError,KeyError,TypeError) as error:
        print(json.dumps({'status':'blocked','failures':[str(error)]}));return 1
if __name__=='__main__':sys.exit(main())
