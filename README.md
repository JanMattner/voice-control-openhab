# Voice Control for openHAB

This is a simple but extensible voice control tool for openHAB.
It is rule based and no data needs to be sent to any external API.

Examples will use the Main UI.

## Usage
You can use e.g. the [openHAB Android](https://www.openhab.org/docs/apps/android.html) to [send speech commands](#4-Enjoy) to your openHAB system, which will be interpreted by this voice control tool.

Commands such as `turn off the kitchen light` or `bring down the bathroom rollershutter` will work, if you have items with unique labels or synonyms `kitchen light` or `bathroom rollershutter`.

Currently only the On/Off and Up/Down type are supported in English and German. Feel free to contribute!

## Prerequisites
### No JavaScript Scripting addon
The files only work with the out-of-the-box JavaScript engine Nashorn. *Note that this means only ECMAScript 5.1 features are supported*.

Ensure that the [JavaScript Scripting addon](https://www.openhab.org/addons/automation/jsscripting/) is *NOT* installed in your openHAB system.

### VoiceCommand Item
The scripts need the spoken input, which is usually saved in a special item. As soon as the item value changes, the scripts will run and try to interpret the spoken command. With this setup, the microphone input of the openHAB Android app will work as source of the speech commands.

Create a new item `VoiceCommand`.

![](/docs/voice_command_item.jpg)

Configure it in the settings as target for the rule voice interpreter: Settings->Rule Voice Interpreter->Voice Command Item

![](/docs/settings_rule_voice_interpreter.jpg)

![](/docs/rule_voice_interpreter_item.jpg)

## Installation in openHAB

### 1. Copy Files and Customize
Copy all the files in the folder `lib/openHAB` to the following folder in your openHAB installation: `<OPENHAB_CONF>/automation/lib/javascript/personal`

Optional: Add your custom rules to the end of `voiceCommandRules.js`.

### 2. Add Script Rule to Call the Interpreter
Add a new ECMAScript `VoiceControl` in Settings->Scripts with the following content:

```javascript
var OPENHAB_CONF = Java.type('java.lang.System').getenv('OPENHAB_CONF');
load(OPENHAB_CONF + '/automation/lib/javascript/personal/voiceCommandRules.js');

ruleBasedInterpreter.interpretUtterance(itemRegistry.getItem("VoiceCommand").getState().toString());
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

Note that the actual files in `lib/openHAB` are limited to ECMAScript 5.1 features, but all the rest (including tests) run with latest ECMAScript features (tested with Node 12.x, 14.x, 16.x).

You can test your rules (except expressions requiring the openHAB specific global variables, e.g. the itemLabel and cmd expressions) in the `index.js` file, just start it by `npm start` or `node lib/index.js` to test them interactively

```
$ npm start

> voice-control-openhab@1.0.0 start C:\GitHub\janmattner\voice-control-openhab
> node lib/index.js

Test your voice control!
> foo
bar
Test your voice control!
>
```
## License
This tool is available under the terms of the [MIT License](./LICENSE).