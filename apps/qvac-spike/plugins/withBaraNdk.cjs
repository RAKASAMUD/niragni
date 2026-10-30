const { withProjectBuildGradle, withGradleProperties, withPodfileProperties } = require('expo/config-plugins');
module.exports = function withBaraNdk(config) {
  config = withGradleProperties(config, mod => {
    mod.modResults = mod.modResults.filter(item => item.type !== 'property' || item.key !== 'android.minSdkVersion');
    mod.modResults.push({type: 'property', key: 'android.minSdkVersion', value: '31'});
    return mod;
  });
  config = withPodfileProperties(config, mod => {
    mod.modResults['ios.deploymentTarget'] = '17.0';
    return mod;
  });
  return withProjectBuildGradle(config, mod => {
    if (!mod.modResults.contents.includes('// Bara shared NDK for native library modules')) {
      mod.modResults.contents += `
// Bara shared NDK for native library modules
// BareKit does not consume rootProject.ext.ndkVersion itself; AGP otherwise picks NDK 27.
subprojects { nativeProject ->
  nativeProject.plugins.withId("com.android.library") {
    nativeProject.android.ndkVersion = "29.0.14206865"
  }
}
`;
    }
    return mod;
  });
};
