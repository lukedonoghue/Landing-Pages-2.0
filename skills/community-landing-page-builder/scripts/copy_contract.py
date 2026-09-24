"""Single canonical copy authority; helper reviews never imply complete acceptance."""
from pathlib import Path
import hashlib
import json
import copy_library
import process_contract

def read(path): return json.loads(Path(path).read_text())
def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def blocked(root, failures):
    # Even missing/mutated-input failures have one reproducible identity.
    paths = copy_files(Path(root))
    hashes = {k: sha(Path(root)/v) if (Path(root)/v).is_file() else None for k,v in paths.items()}
    fingerprint = hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()
    return {'status':'blocked','failures':failures,'fingerprint':fingerprint,'input_hashes':hashes}

COPY_FILES = {
    'copy': 'build/page-copy.json', 'brief': 'build/client-copy-brief.json',
    'context': 'build/copy-context.json', 'review': 'build/copy-editorial-review.json',
    'review_inputs': 'build/copy-review-inputs.json',
}

def lightweight(root):
    config = read(root/'funnel.json') if (root/'funnel.json').is_file() else {}
    return config.get('backend',{}).get('provider') == 'none' and config.get('guided_workflow',{}).get('copy_format') == 'markdown'

def copy_files(root):
    if lightweight(root):
        return {'copy':'build/page-copy.md', 'brief':'build/strategy-brief.md',
                'context':'build/claim-ledger.md', 'review':'build/copy-editorial-review.json',
                'review_inputs':'build/copy-review-inputs.json'}
    return COPY_FILES

def business_contract(config):
    return {**{key:config.get(key) for key in ['client','brief','audience','search_intent','offer','cta','follow_up_promise','form_fields','brochure_gated','conversion']}, **{key:config[key] for key in ('business_follow_up_promise','preview_disclosure','local_test_behavior') if key in config}}

def inspect_core(root):
    root = Path(root).resolve()
    configuration = read(root/'funnel.json') if (root/'funnel.json').is_file() else {}
    if configuration.get('quality', {}).get('contract_version', 0) >= 3 and not configuration.get('development_fixture'):
        import completion_contract
        failures = completion_contract.research(root)
        if failures:
            return blocked(root, failures)
    if configuration.get('quality', {}).get('contract_version', 0) >= 4 and not configuration.get('development_fixture'):
        import research_contract, copy_quality
        failures = research_contract.inspect(root) + copy_quality.inspect(root)
        if failures:
            return blocked(root, failures)
    if configuration.get('guided_workflow'):
        try:
            projection = root/'build/guide-business.json'
            inputs = read(root/'build/copy-review-inputs.json').get('inputs',{})
            rows = [v for v in inputs.values() if v.get('path') == 'build/guide-business.json']
            if read(projection) != business_contract(configuration) or not rows or rows[0].get('sha256') != sha(projection):
                raise ValueError('Business answers changed. Refresh the actual copy review with build/guide-business.json as a source; hosting-only changes do not alter this projection.')
        except (OSError,ValueError,KeyError,TypeError) as error:
            return blocked(root, [str(error)])
    if lightweight(root):
        import copy_acceptance
        try:
            result = copy_acceptance.verify_review(root, root/'build/copy-review-inputs.json', root/'build/copy-editorial-review.json')
            hashes = {key:sha(root/value) for key,value in copy_files(root).items()}
            config = read(root/'funnel.json')
            contract = {key:config.get(key) for key in ['offer','cta','follow_up_promise','audience','search_intent','form_fields','brochure_gated','conversion']}
            contract.update({key:config[key] for key in ('business_follow_up_promise','preview_disclosure','local_test_behavior') if key in config})
            fingerprint = hashlib.sha256(json.dumps({'copy':hashes['copy'],'contract':contract},sort_keys=True).encode()).hexdigest()
            return {**result,'fingerprint':fingerprint,'input_hashes':hashes}
        except (OSError,ValueError,KeyError,TypeError) as error:
            return blocked(root, [str(error)])
    document_result = process_contract.check_copy_documents(root)
    if document_result['status'] == 'blocked': return blocked(root, document_result['failures'])
    paths = {key: root / value for key, value in COPY_FILES.items()}
    missing = [str(path.relative_to(root)) for path in paths.values() if not path.is_file()]
    if missing: return blocked(root, ['Missing copy evidence: ' + ', '.join(missing)])
    audit = copy_library.audit(paths['copy'], paths['brief'], paths['context'], paths['review'])
    failures = audit['failures'] + audit['editorial_requirements']
    hashes = {key: sha(path) for key, path in paths.items()}
    contract = read(root/'funnel.json') if (root/'funnel.json').exists() else {}
    approved_contract = {key:contract.get(key) for key in ['offer','cta','follow_up_promise','audience','search_intent','form_fields','brochure_gated']}
    approved_contract.update({key:contract[key] for key in ('business_follow_up_promise','preview_disclosure','local_test_behavior') if key in contract})
    fingerprint = hashlib.sha256(json.dumps({'copy':hashes['copy'],'contract':approved_contract},sort_keys=True).encode()).hexdigest()
    return {'status':audit['overall_status'],'failures':failures,'fingerprint':fingerprint,'input_hashes':hashes,'warnings':audit['warnings']}



def inspect(root):
    import check_gates
    root=Path(root).resolve()
    try:
        result=inspect_core(root)
        return {**result, 'source_fingerprint':check_gates.source_snapshot(root)['source_fingerprint'],
                'scope':'Canonical project copy acceptance; not whole-project release acceptance'}
    except (OSError,ValueError,KeyError,TypeError,AttributeError) as error:
        result={'status':'blocked','failures':[str(error)]}
        try:result['source_fingerprint']=check_gates.source_snapshot(root)['source_fingerprint']
        except (OSError,ValueError):pass
        return result
