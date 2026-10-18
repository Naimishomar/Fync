// A dependency (TAndroidLame, pulled in for audio compression) declares
// android:allowBackup="true" in its own manifest, so our allowBackup=false
// fails the manifest merge. tools:replace makes the app's value win.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAllowBackupOverride(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';
    const app = manifest.application?.[0];
    if (app) {
      const replace = new Set(String(app.$['tools:replace'] || '').split(',').filter(Boolean));
      replace.add('android:allowBackup');
      app.$['tools:replace'] = [...replace].join(',');
    }
    return cfg;
  });
};
