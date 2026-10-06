import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FilterOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;

/**
 * Assemble l'APK final : ressources (sortie d'aapt2) + classes.dex, entrées non compressées
 * alignées sur 4 octets (resources.arsc, images), puis signature v2 avec apksig.
 *
 * java -cp apksig.jar Package.java <ressources.apk> <classes.dex> <clé.p12> <mot de passe> <alias> <sortie.apk>
 */
public class Package {
  static final long FIXED_TIME = 1199145600000L; // 2008-01-01 : APK reproductible

  public static void main(String[] a) throws Exception {
    File resources = new File(a[0]), dex = new File(a[1]), keystore = new File(a[2]), out = new File(a[5]);
    String pass = a[3], alias = a[4];
    File unsigned = new File(out.getPath() + ".unsigned");
    try (ZipFile in = new ZipFile(resources);
        Counting count = new Counting(new BufferedOutputStream(new FileOutputStream(unsigned)));
        ZipOutputStream zip = new ZipOutputStream(count)) {
      for (ZipEntry e : Collections.list(in.entries())) {
        if (e.isDirectory()) continue;
        byte[] data;
        try (InputStream is = in.getInputStream(e)) {
          data = is.readAllBytes();
        }
        boolean store = e.getMethod() == ZipEntry.STORED || e.getName().equals("resources.arsc");
        add(zip, count, e.getName(), data, store);
      }
      add(zip, count, "classes.dex", Files.readAllBytes(dex.toPath()), false);
    }

    KeyStore ks = KeyStore.getInstance("PKCS12");
    try (InputStream is = new FileInputStream(keystore)) {
      ks.load(is, pass.toCharArray());
    }
    PrivateKey key = (PrivateKey) ks.getKey(alias, pass.toCharArray());
    List<X509Certificate> certs = new ArrayList<>();
    for (Certificate c : ks.getCertificateChain(alias)) certs.add((X509Certificate) c);
    ApkSigner.SignerConfig signer = new ApkSigner.SignerConfig.Builder("AETHERIA", key, certs).build();
    new ApkSigner.Builder(Collections.singletonList(signer))
        .setInputApk(unsigned)
        .setOutputApk(out)
        .setMinSdkVersion(24)
        .setV1SigningEnabled(false) // inutile à partir d’Android 7 (minSdk 24)
        .setV2SigningEnabled(true)
        .build()
        .sign();
    unsigned.delete();

    ApkVerifier.Result r = new ApkVerifier.Builder(out).build().verify();
    if (!r.isVerified()) {
      for (Object err : r.getErrors()) System.err.println("signature : " + err);
      throw new IllegalStateException("APK mal signé");
    }
    System.out.println("signature v2 OK");
  }

  static void add(ZipOutputStream zip, Counting count, String name, byte[] data, boolean store) throws IOException {
    ZipEntry z = new ZipEntry(name);
    z.setTime(FIXED_TIME);
    if (store) {
      CRC32 crc = new CRC32();
      crc.update(data);
      z.setMethod(ZipEntry.STORED);
      z.setSize(data.length);
      z.setCompressedSize(data.length);
      z.setCrc(crc.getValue());
      // champ « extra » d'alignement Android (0xd935) : les données commencent sur un multiple de 4
      long start = count.n + 30 + name.getBytes(StandardCharsets.UTF_8).length + 6;
      int pad = (int) ((4 - start % 4) % 4);
      byte[] extra = new byte[6 + pad];
      extra[0] = 0x35;
      extra[1] = (byte) 0xd9;
      extra[2] = (byte) (2 + pad);
      extra[4] = 4;
      z.setExtra(extra);
    } else {
      z.setMethod(ZipEntry.DEFLATED);
    }
    zip.putNextEntry(z);
    zip.write(data);
    zip.closeEntry();
  }

  static class Counting extends FilterOutputStream {
    long n;

    Counting(OutputStream out) {
      super(out);
    }

    @Override
    public void write(int b) throws IOException {
      out.write(b);
      n++;
    }

    @Override
    public void write(byte[] b, int off, int len) throws IOException {
      out.write(b, off, len);
      n += len;
    }
  }
}
