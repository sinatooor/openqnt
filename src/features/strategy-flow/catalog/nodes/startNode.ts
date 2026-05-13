/**
 * Start Node — the Strategy Context entry point.
 *
 * Every strategy starts here. Holds the portfolio, primary tickers, capital,
 * and run mode that scope every other node downstream. The header chip mirrors
 * its data read-only; clicking the chip opens this node's property panel.
 *
 * Structural rules enforced by `strategyFlowStore`:
 *   - id is always `"start"` (no random suffix)
 *   - at most one Start node per strategy
 *   - non-deletable (Delete/Backspace ignored, store guard rejects removal)
 *   - position pinned at top-left of canvas
 *
 * Validator exemptions (backend `validator.py`):
 *   - Satisfies the "data source" requirement on its own (no indicator needed)
 *   - Cannot have inputs (`NODE_INPUT_TYPES['trigger'] = set()`)
 */
import { NodeCatalogItem } from '../../types';

// Defined inline as an array so the Python TS parser
// (`backend/strategy_flow/dynamic_prompt.py:parse_ts_node_file`) can extract
// the object literal. `START_NODE` is re-exported below as a convenience.
export const START_NODES: NodeCatalogItem[] = [
    {
        type: 'startTrigger',
        nodeType: 'trigger',
        label: 'Start',
        description: 'Strategy entry point — portfolio, tickers, capital, mode',
        tooltip: 'The Strategy Context. Every strategy begins here. Choose the portfolio (broker account), primary tickers, starting capital, and run mode (paper / live / backtest). Downstream nodes inherit this context. There is exactly one Start node per strategy; it cannot be deleted.',
        inputs: [],
        outputs: ['Signal', 'Context'],
        category: 'triggers',
        subcategory: 'Entry',
        icon: 'Play',
        color: '#10b981',
        backtestEligible: true,
        defaultData: {
            triggerType: 'startTrigger',
            portfolio: '',
            tickers: [],
            capital: 10000,
            mode: 'paper',
            childTriggerType: 'manualTrigger',
        },
    },
];

export const START_NODE: NodeCatalogItem = START_NODES[0];
