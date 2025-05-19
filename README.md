# Voice Control for openHAB

This is a simple but extensible voice control tool for openHAB.
It is rule based and no data needs to be sent to any external API.

Examples will use the Main UI.

## Usage
You can use e.g. the [openHAB Android](https://www.openhab.org/docs/apps/android.html) to [send speech commands](#4-Enjoy) to your openHAB system, which will be interpreted by this voice control tool.

Commands such as `turn off the kitchen light` or `bring down the bathroom rollershutter` will work, if you have items with unique labels or synonyms `kitchen light` or `bathroom rollershutter`.

Currently only the On/Off and Up/Down type are supported in English and German. Feel free to contribute!

## Prerequisites
### JavaScript Scripting addon
The files only work with the GraalJS script engine.
Ensure that the [JavaScript Scripting addon](https://www.openhab.org/addons/automation/jsscripting/) is installed in your openHAB system.

### VoiceCommand Item
The scripts need the spoken input, which is usually saved in a special item. As soon as the item value changes, the scripts will run and try to interpret the spoken command. With this setup, the microphone input of the openHAB Android app will work as source of the speech commands.

Create a new item `VoiceCommand`.

![](/docs/voice_command_item.jpg)

Configure it in the settings as target for the rule voice interpreter: Settings->Rule Voice Interpreter->Voice Command Item

![](/docs/settings_rule_voice_interpreter.jpg)

![](/docs/rule_voice_interpreter_item.jpg)

## Installation in openHAB

### 1. Copy Files and Customize
Copy the whole repositoy to the following folder in your openHAB installation: `<OPENHAB_CONF>/automation/personal/voice-control-openhab`

It can be any folder outside `<OPENHAB_CONF>/automation/js`, but in the following the above folder is assumed.

Optional: Add your custom rules to the end of `voiceCommandRules.js`.

In your shell, change the working directory to `<OPENHAB_CONF>/automation/js` and run the following command to install the package, such that it will be found by the JavaScript Scripting addon:
```bash
npm install --omit=dev ../personal/voice-control-openhab/
```

This will install the package into the `node_modules` subfolder. Note that only changes to these files will take effect after a reload, not the files in the copied repository at `<OPENHAB_CONF>/automation/personal/voice-control-openhab` ! So if you need to change anything, either change it directly in the `node_modules` subfolder, or in the copied repository and install the package again (bump a new version or use `npm uninstall` before; please refer to the official npm documentation).

### 2. Add Script Rule to Call the Interpreter
Add a new ECMAScript `VoiceControl` in Settings->Scripts with the following content:

```javascript
(function (data) {
  let vc = require('voice-control-openhab').voiceCommandRules;
  vc.interpretUtterance(items.getItem("VoiceCommand").state);
})(this.event);
```

### 3. Add Rule triggered by Updates to VoiceCommand Item

Add a simple UI rule `VoiceCommandUpdated`, triggered by updates to the `VoiceCommand` Item that executes the created script rule `VoiceControl`:

![](/docs/voice_command_updated_rule.jpg)

![](/docs/voice_command_updated_rule2.jpg)

Here's the YAML code if you prefer this:

```yaml
triggers:
  - id: "1"
    configuration:
      itemName: VoiceCommand
    type: core.ItemStateUpdateTrigger
conditions: []
actions:
  - inputs: {}
    id: "2"
    configuration:
      considerConditions: true
      ruleUIDs:
        - VoiceControl
    type: core.RunRuleAction
```

### 4. Enjoy!
Done! Now you can use e.g. the openHAB Android app to send speech commands, either by the microphone button in the app (not visible in Main UI):

![](/docs/openhab_microphone.jpg)

or by the openHAB speech command widget, which you can place on your home screen:

![](/docs/openhab_widget.jpg)

## Development

After checking out this repository, run

1. `npm install` to install all dependencies and
2. `npm run test` to run all tests.

Note that for development, the [`openhab-js`](https://github.com/openhab/openhab-js) library is installed. It is only used for convenience in mocking/testing and can be omitted in openHAB, as it is available there anyway. Since it relies on an openHAB installation, running and testing the files in this repository is only possible when mocking the `openhab-js` library, otherwise you will encounter errors.

## License
This tool is available under the terms of the [MIT License](./LICENSE).