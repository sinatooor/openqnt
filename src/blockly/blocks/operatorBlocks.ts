import * as Blockly from 'blockly';

// Comparison operators
Blockly.Blocks['operator_equals'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.appendDummyInput()
      .appendField("=");
    this.appendValueInput("RIGHT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setStyle('operator_blocks');
    this.setTooltip("Check if two values are equal");
  }
};

Blockly.Blocks['operator_greater'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.appendDummyInput()
      .appendField(">");
    this.appendValueInput("RIGHT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setStyle('operator_blocks');
    this.setTooltip("Check if left value is greater than right value");
  }
};

Blockly.Blocks['operator_less'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.appendDummyInput()
      .appendField("<");
    this.appendValueInput("RIGHT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setStyle('operator_blocks');
    this.setTooltip("Check if left value is less than right value");
  }
};

// Math operators
Blockly.Blocks['operator_add'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.appendDummyInput()
      .appendField("+");
    this.appendValueInput("RIGHT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('operator_blocks');
    this.setTooltip("Add two values");
  }
};

Blockly.Blocks['operator_subtract'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.appendDummyInput()
      .appendField("-");
    this.appendValueInput("RIGHT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('operator_blocks');
    this.setTooltip("Subtract right value from left value");
  }
};

Blockly.Blocks['operator_multiply'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.appendDummyInput()
      .appendField("×");
    this.appendValueInput("RIGHT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('operator_blocks');
    this.setTooltip("Multiply two values");
  }
};

Blockly.Blocks['operator_divide'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.appendDummyInput()
      .appendField("÷");
    this.appendValueInput("RIGHT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('operator_blocks');
    this.setTooltip("Divide left value by right value");
  }
};

// Logic operators
Blockly.Blocks['operator_and'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck("Boolean");
    this.appendDummyInput()
      .appendField("AND");
    this.appendValueInput("RIGHT")
      .setCheck("Boolean");
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setStyle('operator_blocks');
    this.setTooltip("Returns true if both conditions are true");
  }
};

Blockly.Blocks['operator_or'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck("Boolean");
    this.appendDummyInput()
      .appendField("OR");
    this.appendValueInput("RIGHT")
      .setCheck("Boolean");
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setStyle('operator_blocks');
    this.setTooltip("Returns true if at least one condition is true");
  }
};

Blockly.Blocks['operator_not'] = {
  init: function() {
    this.appendDummyInput()
      .appendField("NOT");
    this.appendValueInput("VALUE")
      .setCheck("Boolean");
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setStyle('operator_blocks');
    this.setTooltip("Inverts the boolean value");
  }
};

Blockly.Blocks['operator_not_equals'] = {
  init: function() {
    this.appendValueInput("LEFT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.appendDummyInput()
      .appendField("≠");
    this.appendValueInput("RIGHT")
      .setCheck(["EnvironmentValue", "TAValue", "Number"]);
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setStyle('operator_blocks');
    this.setTooltip("Check if two values are not equal");
  }
};

Blockly.Blocks['operator_advanced_math'] = {
  init: function() {
    this.appendValueInput("VALUE")
      .setCheck("Number");
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([
        ["abs", "abs"],
        ["sqrt", "sqrt"],
        ["sin", "sin"],
        ["cos", "cos"],
        ["tan", "tan"],
        ["log", "log"],
        ["ln", "ln"],
        ["exp", "exp"],
        ["round", "round"],
        ["floor", "floor"],
        ["ceil", "ceil"]
      ]), "FUNCTION");
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setStyle('operator_blocks');
    this.setTooltip("Apply advanced math function");
  }
};
