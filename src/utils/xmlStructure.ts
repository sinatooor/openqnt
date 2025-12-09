/**
 * Utility to create structure hash from Blockly XML
 * Used to detect if only parameters changed vs structural changes
 */

/**
 * Masks numeric values in XML to create a "structure fingerprint"
 * Same logic as backend strategy_store.py hash_xml_structure()
 * 
 * Example:
 *   <field name="NUM">14</field> → <field name="NUM">#</field>
 *   <mutation ma_period="14"> → <mutation ma_period="#">
 */
export function getXmlStructure(xml: string): string {
    // 1. Normalize whitespace
    let normalized = xml.trim().replace(/>\s+</g, '><');

    // 2. Mask numeric values between tags (e.g., >14< → >#<)
    normalized = normalized.replace(/>(\d+(\.\d+)?)</g, '>#<');

    // 3. Mask numeric attributes (e.g., ma_period="14" → ma_period="#")
    normalized = normalized.replace(/="(\d+(\.\d+)?)"/g, '="#"');

    return normalized;
}

/**
 * Compare two XML strings to determine if only parameters changed
 * Returns true if structure is the same (only numbers differ)
 */
export function hasStructureChanged(xml1: string, xml2: string): boolean {
    const structure1 = getXmlStructure(xml1);
    const structure2 = getXmlStructure(xml2);
    return structure1 !== structure2;
}
