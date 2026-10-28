const { withAppDelegate, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');
module.exports = function withBaraPrivacy(config) {
  config = withAndroidManifest(config, mod => {
    const application = mod.modResults.manifest.application[0];
    application.$['android:allowBackup'] = 'false';
    application.$['android:fullBackupContent'] = 'false';
    application.$['android:dataExtractionRules'] = '@xml/bara_data_extraction_rules';
    // CPU inference and manual drafts must not require a vendor OpenCL library.
    for (const library of application['uses-native-library'] || []) {
      if (library.$['android:name'] === 'libOpenCL.so') library.$['android:required'] = 'false';
    }
    // canOpenURL uses package visibility on Android 11 and later.
    const queries = mod.modResults.manifest.queries ||= [{}];
    const query = queries[0] ||= {};
    const intents = query.intent ||= [];
    for (const scheme of ['tel', 'mailto']) {
      if (!intents.some(intent => intent.data?.some(data => data.$?.['android:scheme'] === scheme))) {
        intents.push({ action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }], data: [{ $: { 'android:scheme': scheme } }] });
      }
    }
    return mod;
  });
  config = withDangerousMod(config, ['android', async mod => {
    const folder = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    await fs.mkdir(folder, {recursive: true});
    const exclusions = ['root', 'file', 'database', 'sharedpref', 'external'].map(domain => `<exclude domain="${domain}" path="."/>`).join('');
    await fs.writeFile(path.join(folder, 'bara_data_extraction_rules.xml'), `<?xml version="1.0" encoding="utf-8"?><data-extraction-rules><cloud-backup>${exclusions}</cloud-backup><device-transfer>${exclusions}</device-transfer></data-extraction-rules>`);
    return mod;
  }]);
  return withAppDelegate(config, (mod) => {
    const anchor = 'return super.application(application, didFinishLaunchingWithOptions: launchOptions)';
    if (mod.modResults.language === 'swift' && !mod.modResults.contents.includes('// Bara private report backup exclusion')) {
      if (!mod.modResults.contents.includes(anchor)) throw new Error('Bara privacy plugin: Swift AppDelegate launch hook not found');
      mod.modResults.contents = mod.modResults.contents.replace(anchor, `// Bara private report backup exclusion
    for directory in [FileManager.SearchPathDirectory.documentDirectory, .applicationSupportDirectory] {
      if var privateURL = FileManager.default.urls(for: directory, in: .userDomainMask).first {
        try? FileManager.default.createDirectory(at: privateURL, withIntermediateDirectories: true)
        var resourceValues = URLResourceValues()
        resourceValues.isExcludedFromBackup = true
        try? privateURL.setResourceValues(resourceValues)
      }
    }
    ${anchor}`);
    }
    return mod;
  });
};
