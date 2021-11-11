// HOW TO load this file from a script/rule created in Main UI:
// var OPENHAB_CONF = Java.type('java.lang.System').getenv('OPENHAB_CONF');
// load(OPENHAB_CONF + '/automation/lib/javascript/personal/utilities.js');

'use strict';
var isOhEnv = typeof module === "undefined" && typeof require === "undefined";

function utilitiesMain(context) {
    'use strict';

    /**
     * Returns the metadata on the passed in item name with the given namespace.
     * Credits to Rich Koshak.
     * @param {string} itemName name of the item to search the metadata on
     * @param {string} namespace namespace of the metadata to return
     * @return {Metadata} the value and configuration or null if the metadata doesn't exist
     */
    function getMetadata(itemName, namespace) {
        var FrameworkUtil = Java.type("org.osgi.framework.FrameworkUtil");
        var _bundle = FrameworkUtil.getBundle(scriptExtension.class);
        var bundle_context = _bundle.getBundleContext()
        var MetadataRegistry_Ref = bundle_context.getServiceReference("org.openhab.core.items.MetadataRegistry");
        var MetadataRegistry = bundle_context.getService(MetadataRegistry_Ref);
        var MetadataKey = Java.type("org.openhab.core.items.MetadataKey");
        return MetadataRegistry.get(new MetadataKey(namespace, itemName));
    }

    // ***
    // EXPORTS
    // ***
    context.utilities = {
        getMetadata: getMetadata
    }
}

if (isOhEnv) {
    utilitiesMain(this); 
} else {
    var context = {};
    utilitiesMain(context);
    module.exports = context;
}