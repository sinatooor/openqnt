import * as Blockly from "blockly";

// Variable blocks
Blockly.Blocks["variables_set"] = {
  init: function () {
    this.appendValueInput("VALUE")
      .appendField("set")
      .appendField(new Blockly.FieldTextInput("myVar"), "VAR")
      .appendField("to");
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle("variable_blocks");
    this.setTooltip("Set a variable to a value");
    this.setHelpUrl("");
  },
};

Blockly.Blocks["variables_get"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("get")
      .appendField(new Blockly.FieldTextInput("myVar"), "VAR");
    this.setInputsInline(true);
    this.setOutput(true, null);
    this.setStyle("variable_blocks");
    this.setTooltip("Get the value of a variable");
    this.setHelpUrl("");
  },
};

Blockly.Blocks["variables_change"] = {
  init: function () {
    this.appendValueInput("DELTA")
      .appendField("change")
      .appendField(new Blockly.FieldTextInput("myVar"), "VAR")
      .appendField("by");
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle("variable_blocks");
    this.setTooltip("Change a variable by adding a value to it");
    this.setHelpUrl("");
  },
};

// Function blocks
Blockly.Blocks["function_define"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("function")
      .appendField(new Blockly.FieldTextInput("myFunction"), "NAME");
    this.appendStatementInput("STACK").appendField("do");
    this.setInputsInline(false);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle("function_blocks");
    this.setTooltip("Define a reusable function");
    this.setHelpUrl("");
  },
};

Blockly.Blocks["function_call"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("call")
      .appendField(new Blockly.FieldTextInput("myFunction"), "NAME");
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle("function_blocks");
    this.setTooltip("Call a function");
    this.setHelpUrl("");
  },
};

Blockly.Blocks["function_return"] = {
  init: function () {
    this.appendValueInput("VALUE").appendField("return");
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setStyle("function_blocks");
    this.setTooltip("Return a value from a function");
    this.setHelpUrl("");
  },
};
