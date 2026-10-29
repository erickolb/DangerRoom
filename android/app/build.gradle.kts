plugins { id("com.android.application") }
android {
    namespace = "net.chateaulore.dangerroom"
    compileSdk = 36
    defaultConfig {
        applicationId = "net.chateaulore.dangerroom"
        minSdk = 28
        targetSdk = 36
        versionCode = 5
        versionName = "0.1.0-beta.18"
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    val signing = listOf("ANDROID_KEYSTORE_PATH", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD").map { providers.environmentVariable(it).orNull }
    require(signing.all { it.isNullOrBlank() } || signing.all { !it.isNullOrBlank() }) { "Provide all four Android signing environment variables." }
    if (signing.all { !it.isNullOrBlank() }) {
        signingConfigs { create("release") { storeFile = file(requireNotNull(signing[0])); storePassword = signing[1]; keyAlias = signing[2]; keyPassword = signing[3] } }
        buildTypes.getByName("release").signingConfig = signingConfigs.getByName("release")
    }
}
dependencies {
    implementation("com.google.zxing:core:3.5.4")
    implementation("androidx.core:core-ktx:1.18.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.mlkit:barcode-scanning:17.3.0")
    implementation("com.google.mlkit:text-recognition:16.0.1")
    testImplementation("junit:junit:4.13.2")
}
