/**
 * Integration Nodes — External service connections (PRD §9.2)
 * Inspired by n8n's integration node pattern — each node connects to a specific service.
 */
import { NodeCatalogItem } from '../../types';

export const INTEGRATION_NODES: NodeCatalogItem[] = [
    // =========================================================================
    // Communication
    // =========================================================================
    {
        type: 'telegramNode',
        nodeType: 'integration',
        label: 'Telegram',
        description: 'Send or receive Telegram messages',
        tooltip: 'Send message or receive reply via Telegram bot. Use for alerts, HITL approvals, or collecting user input during workflow execution.',
        inputs: ['Trigger', 'Data'],
        outputs: ['Signal', 'Response'],
        category: 'integrations',
        subcategory: 'Communication',
        icon: 'Send',
        color: '#0088cc',
        defaultData: {
            integrationType: 'telegramNode',
            action: 'sendMessage',
            message: '',
            chatId: '',
            credentialAlias: 'telegram',
        },
    },
    {
        type: 'slackNode',
        nodeType: 'integration',
        label: 'Slack',
        description: 'Post to Slack channel',
        tooltip: 'Post message to a Slack channel or DM. Supports rich formatting with blocks, buttons, and attachments.',
        inputs: ['Trigger', 'Data'],
        outputs: ['Signal'],
        category: 'integrations',
        subcategory: 'Communication',
        icon: 'Hash',
        color: '#4a154b',
        defaultData: {
            integrationType: 'slackNode',
            channel: '#trading-alerts',
            message: '',
            credentialAlias: 'slack',
        },
    },
    {
        type: 'emailNode',
        nodeType: 'integration',
        label: 'Email',
        description: 'Send email via SendGrid/SMTP',
        tooltip: 'Send email notifications with HTML templates. Use for daily digests, weekly reports, or urgent alerts.',
        inputs: ['Trigger', 'Data'],
        outputs: ['Signal'],
        category: 'integrations',
        subcategory: 'Communication',
        icon: 'Mail',
        color: '#ea4335',
        defaultData: {
            integrationType: 'emailNode',
            to: '',
            subject: 'Strategy Alert',
            body: '',
            credentialAlias: 'sendgrid',
        },
    },
    {
        type: 'smsNode',
        nodeType: 'integration',
        label: 'SMS',
        description: 'Send SMS via Twilio',
        tooltip: 'Send SMS alerts to a phone number. Use for critical, time-sensitive alerts that require immediate attention.',
        inputs: ['Trigger', 'Data'],
        outputs: ['Signal'],
        category: 'integrations',
        subcategory: 'Communication',
        icon: 'Smartphone',
        color: '#f22f46',
        defaultData: {
            integrationType: 'smsNode',
            to: '',
            message: '',
            credentialAlias: 'twilio',
        },
    },
    // =========================================================================
    // Data
    // =========================================================================
    {
        type: 'httpRequestNode',
        nodeType: 'integration',
        label: 'HTTP Request',
        description: 'Call any API',
        tooltip: 'Make HTTP requests to any REST API — the most versatile node. Fetch data, send commands, or integrate with any service that has an API. Inspired by n8n\'s HTTP Request node.',
        inputs: ['Trigger', 'Data'],
        outputs: ['Data', 'Signal'],
        category: 'integrations',
        subcategory: 'Data',
        icon: 'Globe',
        color: '#6366f1',
        defaultData: {
            integrationType: 'httpRequestNode',
            method: 'GET',
            url: '',
            headers: {},
            body: null,
            authentication: 'none',
            credentialAlias: '',
        },
    },
    {
        type: 'databaseQueryNode',
        nodeType: 'integration',
        label: 'Database Query',
        description: 'Run SQL query',
        tooltip: 'Execute a SQL query against the strategy database. Useful for fetching historical data, custom analytics, or writing computed results.',
        inputs: ['Trigger'],
        outputs: ['Data', 'Signal'],
        category: 'integrations',
        subcategory: 'Data',
        icon: 'Database',
        color: '#0ea5e9',
        defaultData: {
            integrationType: 'databaseQueryNode',
            query: 'SELECT * FROM ...',
            parameterized: true,
        },
    },
    // =========================================================================
    // Code
    // =========================================================================
    {
        type: 'codePythonNode',
        nodeType: 'integration',
        label: 'Python Code',
        description: 'Run custom Python',
        tooltip: 'Execute custom Python code within the workflow. Code is sent to the Python compute service for execution. Access to pandas, numpy, ta-lib, and all Python libraries.',
        inputs: ['Trigger', 'Data'],
        outputs: ['Data', 'Signal'],
        category: 'integrations',
        subcategory: 'Code',
        icon: 'Code',
        color: '#3776ab',
        defaultData: {
            integrationType: 'codePythonNode',
            code: '# Python code\nimport pandas as pd\n\ndef execute(input_data):\n    return {"result": input_data}',
            language: 'python',
        },
    },
    {
        type: 'codeJavascriptNode',
        nodeType: 'integration',
        label: 'JavaScript Code',
        description: 'Run custom JavaScript',
        tooltip: 'Execute custom JavaScript code within the workflow. Runs in a sandboxed Node.js environment. Great for data transformation, calculations, and custom logic.',
        inputs: ['Trigger', 'Data'],
        outputs: ['Data', 'Signal'],
        category: 'integrations',
        subcategory: 'Code',
        icon: 'FileCode',
        color: '#f7df1e',
        defaultData: {
            integrationType: 'codeJavascriptNode',
            code: '// JavaScript code\nmodule.exports = function execute(inputData) {\n  return { result: inputData };\n};',
            language: 'javascript',
        },
    },
    // =========================================================================
    // AI
    // =========================================================================
    {
        type: 'aiAnalysisNode',
        nodeType: 'integration',
        label: 'AI Analysis',
        description: 'AI-powered analysis',
        tooltip: 'Send data to the Python ADK agent for AI-powered analysis. Used for sentiment analysis, regime detection, strategy recommendations, and complex decision-making.',
        inputs: ['Trigger', 'Data'],
        outputs: ['Data', 'Signal'],
        category: 'integrations',
        subcategory: 'AI',
        icon: 'Brain',
        color: '#a855f7',
        defaultData: {
            integrationType: 'aiAnalysisNode',
            analysisType: 'general',
            prompt: '',
            context: {},
            model: 'gpt-4o',
        },
    },
];
