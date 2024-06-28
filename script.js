let annotations = {};
let annotatedCodeSegment = "";

function reset_annotate(){
    annotations = {}
}

function annotate() {
    const codeSegment = document.getElementById('codeSegment');
    const selectedText = codeSegment.value.substring(codeSegment.selectionStart, codeSegment.selectionEnd);
    
    if (selectedText) {
        document.getElementById('selectedText').value = selectedText;
        document.getElementById('annotationDialog').style.display = 'block';
    } else {
        alert('Please select a part of the code to annotate.');
    }
}

function closeDialog() {
    document.getElementById('annotationDialog').style.display = 'none';
}

document.getElementById('type').addEventListener('change', function() {
    const type = this.value;
    if (type === 'dropdown') {
        document.getElementById('optionsContainer').style.display = 'block';
        document.getElementById('defaultValueContainer').style.display = 'none';
    } else if (type === 'input_text') {
        document.getElementById('optionsContainer').style.display = 'none';
        document.getElementById('defaultValueContainer').style.display = 'block';
    } else {
        document.getElementById('optionsContainer').style.display = 'none';
        document.getElementById('defaultValueContainer').style.display = 'none';
    }
});

function addAnnotation() {
    const selectedText = document.getElementById('selectedText').value;
    const annotationName = document.getElementById('annotationName').value || selectedText;
    const type = document.getElementById('type').value;
    const annotation = { type };
    
    if (type === 'dropdown') {
        const options = document.getElementById('options').value.split(',').map(option => option.trim());
        annotation.options = options;
    } else if (type === 'input_text') {
        const defaultValue = document.getElementById('defaultValue').value;
        annotation.default = defaultValue;
    }
    
    annotations[annotationName] = annotation;
    closeDialog();
    generateAnnotation(annotationName, selectedText);
}

function generateAnnotation(annotationName, selectedText) {
    const codeSegment = document.getElementById('codeSegment').value;

    // Update the annotated code segment with the new annotation
    if (!annotatedCodeSegment) {
        annotatedCodeSegment = codeSegment;
    }
    annotatedCodeSegment = annotatedCodeSegment.replace(selectedText, `{${annotationName}}`);

    // Generate message format with placeholders
    let messageFormat = annotatedCodeSegment;
    let placeholderIndex = 1;
    for (const key in annotations) {
        messageFormat = messageFormat.replace(`{${key}}`, `%${placeholderIndex}`);
        placeholderIndex++;
    }

    const annotationResult = {
        code_segment: annotatedCodeSegment,
        message_format: messageFormat,
        placeholders: annotations
    };
    document.getElementById('generatedAnnotation').textContent = JSON.stringify(annotationResult, null, 2);
}

function generateBlocklyDefinitions(inputData) {
    const codeSegment = inputData.code_segment;
    const messageFormat = inputData.message_format;
    const placeholders = inputData.placeholders;
    const blockTypeInput = document.getElementById('blockType').value;
    
    // Generate Blockly block definition
    const blockType = blockTypeInput.trim().toLowerCase() + '_block';
    
    const messageParts = messageFormat.split('%');
    const blockArgs = [];
    for (let i = 1; i < messageParts.length; i++) {
        const index = parseInt(messageParts[i][0], 10);
        const placeholderKey = Object.keys(placeholders)[index - 1];
        blockArgs.push(placeholders[placeholderKey]);
        messageParts[i] = '%' + index + messageParts[i].substring(1);
    }
    
    const blockDefinition = {
        type: blockType,
        message0: messageParts.join(''),
        args0: blockArgs,
        previousStatement: null,
        nextStatement: null,
        colour: 160,
        tooltip: `Block for ${blockType.split('_')[0]} function`,
        helpUrl: ""
    };
    
    // Generate JavaScript code generator
    let codeGenerator = `Blockly.JavaScript['${blockType}'] = function(block) {\n`;
    
    for (const [key, value] of Object.entries(placeholders)) {
        if (value.type === 'dropdown') {
            codeGenerator += `  var ${key.toLowerCase()} = block.getFieldValue('${key.toUpperCase()}');\n`;
        } else {
            codeGenerator += `  var ${key.toLowerCase()} = Blockly.JavaScript.valueToCode(block, '${key.toUpperCase()}', Blockly.JavaScript.ORDER_ATOMIC);\n`;
        }
    }
    
    let formattedCodeSegment = codeSegment;
    for (const key of Object.keys(placeholders)) {
        formattedCodeSegment = formattedCodeSegment.replace(`{${key}}`, `' + ${key.toLowerCase()} + '`);
    }
    
    codeGenerator += `  var code = '${formattedCodeSegment}';\n`;
    codeGenerator += "  return code;\n};";
    
    return {
        blockDefinition: blockDefinition,
        codeGenerator: codeGenerator
    };
}

function generateBlocklyCode() {
    const generatedAnnotation = JSON.parse(document.getElementById('generatedAnnotation').value);
    console.log("generated: ", generatedAnnotation)
    const result = generateBlocklyDefinitions(generatedAnnotation);

    document.getElementById('blockDefinition').textContent = JSON.stringify(result.blockDefinition, null, 2);
    document.getElementById('codeGenerator').textContent = result.codeGenerator;
}
