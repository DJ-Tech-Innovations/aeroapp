<?php

return [
    // Version of the learner app shell. Packs with a higher `minAppVersion` ask the user to reload first.
    'version' => '1.1.0',

    // Offline sign-in window: the learner app keeps working this long without reaching the server.
    'offline_days' => (int) env('AEROAPP_OFFLINE_DAYS', 14),

    // Bundled pack shipped inside the app (public/packs) so a first launch has content even on a slow link.
    'bundled_pack' => '1.1.0',

    // Android APK (Trusted Web Activity built with Bubblewrap / PWABuilder). Served at /.well-known/assetlinks.json
    // so Android opens the app full-screen without a browser bar.
    'android' => [
        'package' => env('ANDROID_PACKAGE'),
        'sha256' => array_filter(explode(',', (string) env('ANDROID_SHA256_FINGERPRINTS', ''))),
    ],
];
