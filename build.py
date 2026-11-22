"""Build Nevelkroon.

Produces:
  index.html            single-file game (GitHub Pages serves this)
  build/logic_node.js   game logic as a Node module, for the headless tests in test/
"""
import pathlib

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


def read(names):
    return '\n'.join((SRC / n).read_text(encoding='utf-8').replace("'use strict';\n", '') for n in names)


def main():
    js = "'use strict';\n" + read(LOGIC + CLIENT)
    shell = (SRC / 'shell.html').read_text(encoding='utf-8')
    css = (SRC / 'style.css').read_text(encoding='utf-8')
    html = shell.replace('/*CSS*/', css).replace('/*JS*/', js)
    (ROOT / 'index.html').write_text(html, encoding='utf-8')

    out = ROOT / 'build'
    out.mkdir(exist_ok=True)
    node = "'use strict';\n" + read(LOGIC) + f'\nmodule.exports = {{ {NODE_EXPORTS} }};\n'
    (out / 'logic_node.js').write_text(node, encoding='utf-8')
    print(f'index.html: {len(html):,} bytes')


if __name__ == '__main__':
    main()
