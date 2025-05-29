#!/usr/bin/env node

function logProgress(text) {
    console.log(`[UPDATE YAML] ${text}`);
}

function logError(text) {
    console.error(`[UPDATE YAML] ${text}`);
}

logProgress("Combining script files and update rule template yaml ...");

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function extractUntilMarker(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/^[\s\S]*?(?=\/\/ ==== CUT HERE FOR RULE TEMPLATE YAML ====)/);
    return match ? match[0].trim() : content.trim();
}

function extractBetweenMarkers(filePath, startMarker = '\/\/ ==== YAML RULE TEMPLATE START ====', endMarker = '\/\/ ==== YAML RULE TEMPLATE END ====') {
    const content = fs.readFileSync(filePath, 'utf8');
    const regex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, 'm');
  
    const match = content.match(regex);
    if (match) {
      return match[0]
        .replace(startMarker, '')
        .replace(endMarker, '')
        .trim();
    }
  
    return '';
}

logProgress("Load and extract contents of JS files");
const fileInterpreter = extractBetweenMarkers(path.join(__dirname, '../lib/openHAB/ruleBasedInterpreter.js'));
const fileRules = extractBetweenMarkers(path.join(__dirname, '../lib/openHAB/voiceCommandRules.js'));

const combinedContent = `
(function (data) {

// ***
// INTERPRETER
// ***

${fileInterpreter}

// ***
// RULES
// ***

${fileRules}

// ***
// EXECUTION
// ***

let vcString = items.getItem("{{VoiceCommandItem}}").state;
interpretUtterance(vcString);

})(this.event);
`;

logProgress("Load the YAML file and inject content");
const yamlPath = path.join(__dirname, '../rule-template/cuevox.yaml');
const yamlContent = fs.readFileSync(yamlPath, 'utf8');
const data = yaml.load(yamlContent);

// Inject combined JS content into a scripts field
const scriptAction = data.actions.filter(a => a.id === "2");
if (scriptAction.length === 0) {
    logError("No action with ID 2 found, which should contain the script action.");
    return;
}

scriptAction[0].configuration.script = combinedContent;

logProgress("Convert back to YAML and save");
const newYaml = yaml.dump(data, { lineWidth: -1 });
fs.writeFileSync(yamlPath, newYaml, 'utf8');

logProgress('Rule template YAML updated successfully.');
