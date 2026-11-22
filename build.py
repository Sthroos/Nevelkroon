"""Build Nevelkroon.

Produces:
  index.html            single-file game (GitHub Pages serves this)
  build/logic_node.js   game logic as a Node module, for the headless tests in test/
"""
import datetime
import hashlib
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / 'src'
LOGIC = ['data.js', 'logic_core.js', 'logic_game.js', 'logic_turn.js', 'logic_ai.js']
CLIENT = ['audio.js', 'render.js', 'ui.js']
NODE_EXPORTS = (
    'D, createGame, processTurn, computeIncome, scoreOf, empirePower, systemsOf, coloniesOf, '
    'colonyMaxPop, relaysHeld, relaysNeeded, GameError, queueBuilding, queueShip, chooseResearch, '
    'moveFleet, orderSurvey, orderOutpost, orderColonize, orderUpgrade, setAuto, mergeFleets, '
    'splitFleet, declareWar, proposePeace, proposePact, sendGift, marketTrade, startKroon, '
    'enactEdict, resolvePending, canBuild, canBuildShip, techCost, opinion, fleetPower, aiTurn'
)


def version():
    """1.<n> where n = commit count (+1 when src/ has uncommitted changes, i.e. the next commit), build date, source hash."""
    git = lambda *a: subprocess.run(['git', *a], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    count = int(git('rev-list', '--count', 'HEAD'))
    pending = bool(git('status', '--porcelain', '--', 'src').strip())
    digest = hashlib.sha256()
    for f in sorted(SRC.iterdir()):
        digest.update(f.name.encode() + f.read_bytes())
    today = datetime.date.today().isoformat()
    return f"1.{count + (1 if pending else 0)} · {today} · {digest.hexdigest()[:7]}"


def read(names):
    return '\n'.join((SRC / n).read_text(encoding='utf-8').replace("'use strict';\n", '') for n in names)


def main():
    ver = version()
    js = "'use strict';\n" + f"const GAME_VERSION = '{ver}';\n" + read(LOGIC + CLIENT)
    shell = (SRC / 'shell.html').read_text(encoding='utf-8')
    css = (SRC / 'style.css').read_text(encoding='utf-8')
    html = shell.replace('/*CSS*/', css).replace('/*JS*/', js)
    (ROOT / 'index.html').write_text(html, encoding='utf-8')

    out = ROOT / 'build'
    out.mkdir(exist_ok=True)
    node = "'use strict';\n" + read(LOGIC) + f'\nmodule.exports = {{ {NODE_EXPORTS} }};\n'
    (out / 'logic_node.js').write_text(node, encoding='utf-8')
    print(f'index.html: {len(html):,} bytes, versie {ver}')


if __name__ == '__main__':
    main()
