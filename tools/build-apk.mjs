// Construit l'application Android (APK signé) à partir du jeu : node tools/build-apk.mjs
// Pas besoin du SDK Android : aapt2 (apktool), dx et apksig sont téléchargés depuis Maven Central
// dans android/.tools au premier lancement (ou AETHERIA_APK_TOOLS=<dossier>). Il faut Java 11+.
//   --no-vite  : réutilise dist/ tel quel
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const android = path.join(root, 'android');
const build = path.join(android, 'build');
const tools = path.resolve(process.env.AETHERIA_APK_TOOLS || path.join(android, '.tools'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const app = JSON.parse(fs.readFileSync(path.join(android, 'app.json'), 'utf8'));
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });
const step = (s) => console.log('\n▸ ' + s);

// ------------------------------------------------------------------ outils
const MAVEN = 'https://repo.maven.apache.org/maven2/';
const JARS = {
  'apktool-lib.jar': 'org/apktool/apktool-lib/3.0.3/apktool-lib-3.0.3.jar',
  'dx.jar': 'com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar',
  'apksig.jar': 'com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar',
  'android-stub.jar': 'com/google/android/android/4.1.1.4/android-4.1.1.4.jar',
};
fs.mkdirSync(tools, { recursive: true });
for (const [name, rel] of Object.entries(JARS)) {
  const f = path.join(tools, name);
  if (fs.existsSync(f) && fs.statSync(f).size > 10000) continue;
  step('téléchargement ' + name);
  run('curl', ['-fsSL', '--retry', '3', '-o', f, MAVEN + rel]);
}
const aapt2 = path.join(tools, 'prebuilt', 'linux', 'aapt2');
const framework = path.join(tools, 'prebuilt', 'android-framework.jar');
if (!fs.existsSync(aapt2) || !fs.existsSync(framework)) {
  run('unzip', ['-o', '-q', path.join(tools, 'apktool-lib.jar'), 'prebuilt/linux/aapt2', 'prebuilt/android-framework.jar', '-d', tools]);
  fs.chmodSync(aapt2, 0o755);
}

// ------------------------------------------------------------------ jeu (HTML/JS/modèles)
if (!process.argv.includes('--no-vite')) { step('build du jeu'); run('npm', ['run', 'build'], { cwd: root }); }
fs.rmSync(build, { recursive: true, force: true });
const www = path.join(build, 'assets', 'www');
fs.mkdirSync(www, { recursive: true });
fs.cpSync(path.join(root, 'dist'), www, { recursive: true });
fs.cpSync(path.join(android, 'www'), www, { recursive: true });
// polices embarquées au lieu de Google Fonts : le jeu démarre sans connexion
let html = fs.readFileSync(path.join(www, 'index.html'), 'utf8');
html = html.replace(/\s*<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/g, '');
html = html.replace('</title>', '</title>\n<link rel="stylesheet" href="./fonts/fonts.css">\n<meta name="theme-color" content="#0E0A24">');
fs.writeFileSync(path.join(www, 'index.html'), html);

// ------------------------------------------------------------------ ressources Android
step('aapt2 : ressources et manifeste');
const compiled = path.join(build, 'res.zip');
run(aapt2, ['compile', '--dir', path.join(android, 'res'), '-o', compiled]);
const resApk = path.join(build, 'resources.apk');
run(aapt2, ['link', '-o', resApk, '-I', framework, '--manifest', path.join(android, 'AndroidManifest.xml'),
  '--min-sdk-version', '24', '--target-sdk-version', '34',
  '--version-code', String(app.versionCode), '--version-name', app.versionName || pkg.version,
  '-A', path.join(build, 'assets'), compiled]);

// ------------------------------------------------------------------ code Java → dex
step('javac + dx');
const javaFiles = (dir) => fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.java')).map((f) => path.join(dir, f));
const stubs = path.join(build, 'stubs'), classes = path.join(build, 'classes');
const stub = path.join(tools, 'android-stub.jar');
const javac = ['-nowarn', '-Xlint:-options', '-encoding', 'UTF-8', '--release', '8'];
run('javac', [...javac, '-cp', stub, '-d', stubs, ...javaFiles(path.join(android, 'stubs'))]);
run('javac', [...javac, '-cp', stub + path.delimiter + stubs, '-d', classes, ...javaFiles(path.join(android, 'src'))]);
const dex = path.join(build, 'classes.dex');
run('java', ['-cp', path.join(tools, 'dx.jar'), 'com.android.dx.command.Main', '--dex', '--min-sdk-version=24', '--output=' + dex, classes]);

// ------------------------------------------------------------------ assemblage et signature
step('assemblage + signature');
const key = path.join(android, 'keystore', 'aetheria.p12');
if (!fs.existsSync(key)) {
  fs.mkdirSync(path.dirname(key), { recursive: true });
  run('keytool', ['-genkeypair', '-alias', 'aetheria', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '20000',
    '-storetype', 'PKCS12', '-keystore', key, '-storepass', app.storePass, '-dname', 'CN=Aetheria, O=Aetheria']);
}
const out = path.join(android, 'build', `Aetheria-${app.versionName}.apk`);
// apksig 2.3 (Maven Central) touche à des classes internes du JDK
const exportsJdk = ['x509', 'pkcs', 'util'].flatMap((p) => ['--add-exports', `java.base/sun.security.${p}=ALL-UNNAMED`]);
run('java', [...exportsJdk, '-cp', path.join(tools, 'apksig.jar'), path.join(android, 'tools', 'Package.java'), resApk, dex, key, app.storePass, 'aetheria', out]);
console.log(`\n✔ ${path.relative(root, out)} (${(fs.statSync(out).size / 1048576).toFixed(1)} Mo)`);
