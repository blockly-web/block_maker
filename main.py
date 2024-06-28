import json

def generate_blockly_definitions(input_data):
    code_segment = input_data["code_segment"]
    message_format = input_data["message_format"]
    placeholders = input_data["placeholders"]
    
    # Generate Blockly block definition
    block_type = code_segment.split('(')[0].strip().split('.')[-1].lower() + '_block'
    
    message_parts = message_format.split('%')
    block_args = []
    for i, part in enumerate(message_parts):
        if i == 0:
            continue
        index = int(part[0])
        placeholder_key = list(placeholders.keys())[index - 1]
        block_args.append(placeholders[placeholder_key])
        message_parts[i] = '%' + str(index) + part[1:]
    
    block_definition = {
        "type": block_type,
        "message0": "".join(message_parts),
        "args0": block_args,
        "previousStatement": None,
        "nextStatement": None,
        "colour": 160,
        "tooltip": f"Block for {block_type.split('_')[0]} function",
        "helpUrl": ""
    }
    
    # Generate JavaScript code generator
    code_generator = f"Blockly.JavaScript['{block_type}'] = function(block) {{\n"
    
    for key, value in placeholders.items():
        if value['type'] == 'dropdown':
            code_generator += f"  var {key.lower()} = block.getFieldValue('{key.upper()}');\n"
        else:
            code_generator += f"  var {key.lower()} = Blockly.JavaScript.valueToCode(block, '{key.upper()}', Blockly.JavaScript.ORDER_ATOMIC);\n"
    
    formatted_code_segment = code_segment
    for key in placeholders.keys():
        formatted_code_segment = formatted_code_segment.replace(f"{{{key}}}", f"' + {key.lower()} + '")
    
    code_generator += f"  var code = '{formatted_code_segment}';\n"
    code_generator += "  return code;\n};"
    
    return block_definition, code_generator

# Example input data
input_data = {
    "code_segment": "console.{type}(\"{message}\")",
    "message_format": "console.%1(\"%2\")",
    "placeholders": {
        "type": {
            "type": "dropdown",
            "options": [
                "log",
                "err",
                "warnning"
            ]
        },
        "message": {
            "type": "input_value"
        }
    }
}

block_definition, code_generator = generate_blockly_definitions(input_data)

print("Block Definition:")
print(json.dumps(block_definition, indent=2))

print("\nCode Generator:")
print(code_generator)
