import json
from pathlib import Path
import tempfile
import unittest
from build import build


class BuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'example.py').write_text('first\n</script><script>alert(1)</script>\nlast\n')
        self.flow = {'title': 'Example', 'summary': 'One action', 'steps': [
            {'id': 'start', 'title': 'Start', 'explanation': 'Why', 'boundary': 'API',
             'source': {'path': 'example.py', 'start': 2, 'end': 2},
             'inputs': {}, 'outputs': {}, 'state': {}}],
            'scenarios': [{'id': 'ok', 'title': 'Success', 'description': 'Example', 'steps': ['start']}]}

    def render(self):
        path = self.root / 'flow.json'
        path.write_text(json.dumps(self.flow))
        return build(self.root, path, self.root / 'viewer.html')

    def test_exact_source_and_safe_embedding(self):
        generated = self.render()
        self.assertEqual(generated['steps'][0]['source']['code'], '</script><script>alert(1)</script>')
        html = (self.root / 'viewer.html').read_text()
        self.assertNotIn('</script><script>alert(1)</script>', html)
        self.assertIn('\\u003c/script>', html)

    def test_reject_invalid_range(self):
        self.flow['steps'][0]['source']['end'] = 50
        with self.assertRaisesRegex(ValueError, 'Invalid source range'):
            self.render()

    def test_reject_traversal_and_symlink(self):
        for name in ('../outside.py', 'linked.py'):
            if name == 'linked.py':
                (self.root / name).symlink_to('/etc/hosts')
            self.flow['steps'][0]['source']['path'] = name
            with self.assertRaisesRegex(ValueError, 'inside the project'):
                self.render()

    def test_reject_missing_step(self):
        self.flow['scenarios'][0]['steps'] = ['missing']
        with self.assertRaisesRegex(ValueError, 'unknown step'):
            self.render()

    def test_reject_duplicate_steps(self):
        self.flow['steps'].append(dict(self.flow['steps'][0]))
        with self.assertRaisesRegex(ValueError, 'Duplicate step'):
            self.render()

    def test_hash_uses_actual_file_bytes_and_path_is_normalized(self):
        import hashlib
        raw = b'first\r\nsecond\r\n'
        (self.root / 'example.py').write_bytes(raw)
        self.flow['steps'][0]['source']['path'] = './example.py'
        generated = self.render()
        source = generated['steps'][0]['source']
        self.assertEqual(source['sha256'], hashlib.sha256(raw).hexdigest())
        self.assertEqual(source['path'], 'example.py')
        self.assertEqual(source['code'], 'second')


if __name__ == '__main__':
    unittest.main()
