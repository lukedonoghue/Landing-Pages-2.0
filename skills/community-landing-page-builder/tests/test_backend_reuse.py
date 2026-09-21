import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('backend_reuse', Path(__file__).resolve().parents[1] / 'scripts/verify_backend_reuse.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BackendReuseTests(unittest.TestCase):
    def test_configuration_can_change_but_shared_capture_cannot(self):
        with tempfile.TemporaryDirectory() as directory:
            template, project = Path(directory) / 'template', Path(directory) / 'project'
            for root in (template, project):
                for relative in ('src/worker.js', 'public/funnel.js', 'public/privacy-controls.js', 'public/privacy-controls.css', 'public/admin/users.css', 'public/login.js'):
                    file = root / relative
                    file.parent.mkdir(parents=True, exist_ok=True)
                    file.write_text('shared core')
            (project / 'src/site-config.json').write_text('{"name":"Different business"}')
            self.assertEqual(module.verify(project, template)['status'], 'pass')
            (project / 'public/funnel.js').write_text('new handwritten capture')
            result = module.verify(project, template)
            self.assertEqual(result['status'], 'blocked')
            self.assertEqual([item['path'] for item in result['files'] if not item['matches']], ['public/funnel.js'])
            (project / 'public/funnel.js').unlink()
            self.assertEqual(module.verify(project, template)['status'], 'blocked')

    def test_reused_user_controls_and_login_are_checked(self):
        with tempfile.TemporaryDirectory() as directory:
            template, project = Path(directory) / 'template', Path(directory) / 'project'
            for root in (template, project):
                for relative in ('public/funnel.js', 'public/privacy-controls.js', 'public/privacy-controls.css', 'public/admin/users.css', 'public/login.js'):
                    file = root / relative
                    file.parent.mkdir(parents=True, exist_ok=True)
                    file.write_text('shared core')
            for relative in ('public/admin/users.css', 'public/login.js'):
                target = project / relative
                target.write_text('client-specific replacement')
                self.assertEqual([item['path'] for item in module.verify(project, template)['files'] if not item['matches']], [relative])
                target.write_text('shared core')
