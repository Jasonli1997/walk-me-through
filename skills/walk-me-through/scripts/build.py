"""Build a portable, source-grounded workflow viewer. No dependencies required."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from datetime import datetime, timezone


def build(root, flow_path, output):
    root = Path(root).resolve()
    flow = json.loads(Path(flow_path).read_text())
    for field in ('title', 'summary'):
        if not isinstance(flow.get(field), str) or not flow[field].strip():
            raise ValueError(f'Missing {field}')
    if not flow.get('steps') or not flow.get('scenarios'):
        raise ValueError('A flow needs steps and scenarios')
    ids = set()
    for step in flow['steps']:
        for field in ('id', 'title', 'explanation', 'boundary'):
            if not isinstance(step.get(field), str) or not step[field].strip():
                raise ValueError(f'Step missing {field}')
        if step['id'] in ids:
            raise ValueError(f'Duplicate step: {step["id"]}')
        ids.add(step['id'])
        for field in ('inputs', 'outputs', 'state'):
            if not isinstance(step.get(field), dict):
                raise ValueError(f'Step {step["id"]} needs an object for {field}')
        source = step['source']
        path = (root / source['path']).resolve()
        if Path(source['path']).is_absolute() or not path.is_relative_to(root):
            raise ValueError('Source must be inside the project')
        source_bytes = path.read_bytes()
        content = source_bytes.decode('utf-8')
        source['path'] = path.relative_to(root).as_posix()
        lines = content.splitlines()
        start, end = source['start'], source['end']
        if type(start) is not int or type(end) is not int or not 1 <= start <= end <= len(lines):
            raise ValueError(f'Invalid source range: {source}')
        source['code'] = '\n'.join(lines[start - 1:end])
        source['sha256'] = hashlib.sha256(source_bytes).hexdigest()
    scenario_ids = set()
    for scenario in flow['scenarios']:
        if scenario['id'] in scenario_ids:
            raise ValueError('Duplicate scenario')
        scenario_ids.add(scenario['id'])
        if not scenario.get('title') or not scenario.get('description') or not scenario.get('steps'):
            raise ValueError('Scenario needs title, description and steps')
        if any(step not in ids for step in scenario['steps']):
            raise ValueError('Scenario references an unknown step')
    commit = subprocess.run(['git', '-C', str(root), 'rev-parse', 'HEAD'], capture_output=True, text=True)
    flow['snapshot'] = {'commit': commit.stdout.strip() if commit.returncode == 0 else 'Not a Git repository',
                        'builtAt': datetime.now(timezone.utc).isoformat()}
    template = (Path(__file__).parent.parent / 'assets/viewer.html').read_text()
    # JSON lives in a script element; escape '<' so source cannot close that element.
    freshness = (Path(__file__).parent.parent / 'assets/freshness.js').read_text()
    template = template.replace('__FRESHNESS_JS__', freshness)
    html = template.replace('__FLOW_JSON__', json.dumps(flow, ensure_ascii=True).replace('<', '\\u003c'))
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html)
    return flow


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True)
    parser.add_argument('--flow', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    build(args.root, args.flow, args.output)
