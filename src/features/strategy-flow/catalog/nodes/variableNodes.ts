/**
 * Variable Nodes - State management for the strategy builder
 */
import { NodeCatalogItem } from '../../types';

export const VARIABLE_NODES: NodeCatalogItem[] = [
    {
        type: 'setVariable',
        nodeType: 'variable',
        label: 'Set Variable',
        description: 'Store a value',
        tooltip: 'Save a value to a named variable. Access it later with Get Variable.',
        inputs: ['Value'],
        outputs: ['Signal'],
        category: 'variables',
        icon: 'Edit3',
        color: '#ec4899',
        defaultData: { variableType: 'setVariable', variableName: 'myVar', value: 0 },
    },
    {
        type: 'getVariable',
        nodeType: 'variable',
        label: 'Get Variable',
        description: 'Retrieve stored value',
        tooltip: 'Read a previously stored variable value. Use in calculations or conditions.',
        inputs: [],
        outputs: ['Value'],
        category: 'variables',
        icon: 'Eye',
        color: '#ec4899',
        defaultData: { variableType: 'getVariable', variableName: 'myVar' },
    },
    {
        type: 'changeVariable',
        nodeType: 'variable',
        label: 'Change Variable',
        description: 'Modify by amount',
        tooltip: 'Increase or decrease a variable. Useful for counters and tracking.',
        inputs: ['Value'],
        outputs: ['Signal'],
        category: 'variables',
        icon: 'PlusCircle',
        color: '#ec4899',
        defaultData: { variableType: 'changeVariable', variableName: 'myVar', value: 1 },
    },
    {
        type: 'number',
        nodeType: 'math',
        label: 'Number',
        description: 'Constant value',
        tooltip: 'A fixed numeric value. Use as input to other nodes.',
        inputs: [],
        outputs: ['Number'],
        category: 'variables',
        icon: 'Hash',
        color: '#0ea5e9',
        defaultData: { mathType: 'number', value: 0 },
    },
];
